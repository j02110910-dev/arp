/**
 * Output Verifier - Main Orchestrator
 * Coordinates verification of agent claims across multiple verifier types
 */

import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  OutputVerifierConfig,
  AgentClaim,
  VerificationResult,
  VerificationReport,
  Verifier,
  VerifierType,
  VerificationStatus,
} from './types';
import { SchemaVerifier, ApiVerifier, ScreenshotVerifier, E2eVerifier } from './verifiers';

export class OutputVerifier {
  private config: OutputVerifierConfig;
  private verifiers: Map<VerifierType, Verifier> = new Map();
  private reportHistory: VerificationReport[] = [];

  constructor(config: OutputVerifierConfig) {
    this.config = config;
    this.setupVerifiers();
    this.loadReportHistory();
  }

  private setupVerifiers(): void {
    if (this.config.verifiers.schema?.enabled) {
      this.verifiers.set('schema', new SchemaVerifier(this.config.verifiers.schema));
    }
    if (this.config.verifiers.api?.enabled) {
      this.verifiers.set('api', new ApiVerifier(this.config.verifiers.api));
    }
    if (this.config.verifiers.data?.enabled) {
      this.verifiers.set('data', new ApiVerifier(this.config.verifiers.data));
    }
    if (this.config.verifiers.screenshot?.enabled) {
      this.verifiers.set('screenshot', new ScreenshotVerifier(this.config.verifiers.screenshot));
    }
    if (this.config.verifiers.e2e?.enabled) {
      this.verifiers.set('e2e', new E2eVerifier(this.config.verifiers.e2e));
    }
  }

  /**
   * Verify an agent claim using all applicable verifiers
   */
  async verify(claim: AgentClaim): Promise<VerificationReport> {
    const startTime = Date.now();
    const results: VerificationResult[] = [];

    for (const [type, verifier] of this.verifiers) {
      if (verifier.canVerify(claim)) {
        try {
          const result = await verifier.verify(claim);
          results.push(result);
        } catch (error) {
          results.push({
            id: uuidv4(),
            claimId: claim.id,
            verifierType: type,
            status: 'error',
            score: 0,
            message: `Verifier "${type}" failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            details: [],
            timestamp: new Date(),
            durationMs: Date.now() - startTime,
          });
        }
      }
    }

    // If no verifiers ran, create a skipped report
    if (results.length === 0) {
      results.push({
        id: uuidv4(),
        claimId: claim.id,
        verifierType: 'schema',
        status: 'skipped',
        score: 100,
        message: 'No applicable verifiers found for this claim',
        details: [],
        timestamp: new Date(),
        durationMs: Date.now() - startTime,
      });
    }

    // Aggregate results
    const report = this.buildReport(claim, results, startTime);

    // Save to history
    this.reportHistory.push(report);
    this.saveReportHistory();

    // Call callback if set
    if (this.config.onVerification) {
      try {
        const bestResult = results.reduce((best, r) => r.score > best.score ? r : best, results[0]);
        this.config.onVerification(bestResult);
      } catch (error) {
        console.error('[OutputVerifier] Callback error:', error);
      }
    }

    return report;
  }

  /**
   * Quick verify: just check output against a schema
   */
  async verifyOutput(
    output: unknown,
    schema?: Record<string, unknown>,
    requiredFields?: string[]
  ): Promise<VerificationResult> {
    const claim: AgentClaim = {
      id: uuidv4(),
      timestamp: new Date(),
      description: 'Quick output verification',
      output,
    };

    // Temporarily configure schema verifier if schema provided
    if (schema || requiredFields) {
      const tempVerifier = new SchemaVerifier({
        enabled: true,
        schema,
        requiredFields,
      });
      return tempVerifier.verify(claim);
    }

    // Use default verifiers
    const report = await this.verify(claim);
    return report.results[0];
  }

  /**
   * Verify tool calls were successful
   */
  async verifyToolCalls(
    toolCalls: AgentClaim['toolCalls'],
    expectedTools?: string[]
  ): Promise<VerificationResult> {
    const claim: AgentClaim = {
      id: uuidv4(),
      timestamp: new Date(),
      description: 'Tool call verification',
      toolCalls,
    };

    if (expectedTools && toolCalls) {
      const details: VerificationResult['details'] = [];
      let score = 100;

      for (const expectedTool of expectedTools) {
        const found = toolCalls.some(tc => tc.tool === expectedTool);
        details.push({
          field: `tool.${expectedTool}`,
          passed: found,
          message: found
            ? `Tool "${expectedTool}" was called`
            : `Tool "${expectedTool}" was NOT called`,
        });
        if (!found) score -= 25;
      }

      // Check that all tool calls have results
      for (const tc of toolCalls) {
        const hasResult = tc.result !== undefined;
        details.push({
          field: `${tc.tool}.result`,
          passed: hasResult,
          message: hasResult
            ? `Tool "${tc.tool}" returned a result`
            : `Tool "${tc.tool}" has no result`,
        });
        if (!hasResult) score -= 15;
      }

      score = Math.max(0, score);
      const status = score >= 80 ? 'passed' : score >= 50 ? 'partial' : 'failed';

      return {
        id: uuidv4(),
        claimId: claim.id,
        verifierType: 'schema',
        status,
        score,
        message: `Tool call verification: ${status} (score: ${score}/100)`,
        details,
        timestamp: new Date(),
        durationMs: 0,
      };
    }

    const report = await this.verify(claim);
    return report.results[0];
  }

  /**
   * Get verification history
   */
  getReports(limit = 10): VerificationReport[] {
    return this.reportHistory.slice(-limit);
  }

  /**
   * Get verification statistics
   */
  getStats(): {
    totalVerifications: number;
    passed: number;
    failed: number;
    partial: number;
    averageScore: number;
  } {
    const reports = this.reportHistory;
    let passed = 0;
    let failed = 0;
    let partial = 0;
    let totalScore = 0;

    for (const report of reports) {
      if (report.overallStatus === 'passed') passed++;
      else if (report.overallStatus === 'failed') failed++;
      else if (report.overallStatus === 'partial') partial++;
      totalScore += report.overallScore;
    }

    return {
      totalVerifications: reports.length,
      passed,
      failed,
      partial,
      averageScore: reports.length > 0 ? Math.round(totalScore / reports.length) : 0,
    };
  }

  /**
   * Clear report history
   */
  clearHistory(): void {
    this.reportHistory = [];
    this.saveReportHistory();
  }

  private buildReport(
    claim: AgentClaim,
    results: VerificationResult[],
    startTime: number
  ): VerificationReport {
    // Calculate overall status
    const statuses = results.map(r => r.status);
    let overallStatus: VerificationStatus;
    if (statuses.every(s => s === 'passed')) {
      overallStatus = 'passed';
    } else if (statuses.some(s => s === 'failed')) {
      overallStatus = 'failed';
    } else if (statuses.some(s => s === 'partial')) {
      overallStatus = 'partial';
    } else if (statuses.some(s => s === 'error')) {
      overallStatus = 'error';
    } else {
      overallStatus = 'skipped';
    }

    // Calculate overall score
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const overallScore = Math.round(totalScore / results.length);

    // Build summary
    const passedCount = results.filter(r => r.status === 'passed').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const summary = overallStatus === 'passed'
      ? `✅ All ${results.length} verification(s) passed (score: ${overallScore}/100)`
      : overallStatus === 'failed'
      ? `❌ ${failedCount}/${results.length} verification(s) failed (score: ${overallScore}/100)`
      : `⚠️ Verification ${overallStatus} (score: ${overallScore}/100)`;

    return {
      id: uuidv4(),
      claim,
      results,
      overallStatus,
      overallScore,
      timestamp: new Date(),
      totalDurationMs: Date.now() - startTime,
      summary,
    };
  }

  private loadReportHistory(): void {
    if (!this.config.reportPath) return;

    try {
      if (fs.existsSync(this.config.reportPath)) {
        const data = fs.readFileSync(this.config.reportPath, 'utf-8');
        const reports = JSON.parse(data);
        this.reportHistory = reports.map((r: VerificationReport) => ({
          ...r,
          timestamp: new Date(r.timestamp),
          claim: {
            ...r.claim,
            timestamp: new Date(r.claim.timestamp),
          },
          results: r.results.map((vr: VerificationResult) => ({
            ...vr,
            timestamp: new Date(vr.timestamp),
          })),
        }));
        console.log(`[OutputVerifier] Loaded ${this.reportHistory.length} past reports`);
      }
    } catch (error) {
      console.error('[OutputVerifier] Failed to load report history:', error);
      this.reportHistory = [];
    }
  }

  private saveReportHistory(): void {
    if (!this.config.reportPath) return;

    try {
      const toSave = this.reportHistory.slice(-(this.config.maxReports || 100));
      fs.writeFileSync(
        this.config.reportPath,
        JSON.stringify(toSave, null, 2)
      );
    } catch (error) {
      console.error('[OutputVerifier] Failed to save report history:', error);
    }
  }

  /**
   * Stop the verifier and save state
   */
  stop(): void {
    this.saveReportHistory();
    console.log('[OutputVerifier] Verifier stopped');
  }
}
