/**
 * Data Verifier
 * Verifies agent claims by validating data outputs and structures
 */

import { Verifier, VerifierType, AgentClaim, VerificationResult, DataVerifierConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class DataVerifier implements Verifier {
  type: VerifierType = 'data';
  name = 'Data Verifier';

  private config: DataVerifierConfig;

  constructor(config: DataVerifierConfig) {
    this.config = config;
  }

  canVerify(claim: AgentClaim): boolean {
    // Can verify if tool calls include data-related operations
    if (!claim.toolCalls || claim.toolCalls.length === 0) return false;
    return claim.toolCalls.some(tc =>
      tc.tool.includes('data') ||
      tc.tool.includes('query') ||
      tc.tool.includes('database') ||
      tc.tool.includes('sql') ||
      tc.tool.includes('select') ||
      tc.tool.includes('insert') ||
      tc.tool.includes('update') ||
      tc.tool.includes('delete') ||
      tc.args?.data !== undefined ||
      tc.args?.result !== undefined
    );
  }

  async verify(claim: AgentClaim): Promise<VerificationResult> {
    const startTime = Date.now();
    const details: VerificationResult['details'] = [];
    let score = 100;

    // Extract data-related tool calls
    const dataCalls = (claim.toolCalls || []).filter(tc =>
      tc.tool.includes('data') ||
      tc.tool.includes('query') ||
      tc.tool.includes('database') ||
      tc.tool.includes('sql') ||
      tc.tool.includes('select') ||
      tc.tool.includes('insert') ||
      tc.tool.includes('update') ||
      tc.tool.includes('delete') ||
      tc.args?.data !== undefined ||
      tc.args?.result !== undefined
    );

    if (dataCalls.length === 0) {
      return this.buildResult(claim.id, 'skipped', 100, 'No data operations found to verify', details, startTime);
    }

    // Check each data operation
    for (const call of dataCalls) {
      // 1. Check if data operation returned a result
      if (call.result === undefined || call.result === null) {
        details.push({
          field: `${call.tool}.result`,
          passed: false,
          message: `Data operation "${call.tool}" returned no result`,
        });
        score -= 30;
        continue;
      }

      // 2. Check if result has meaningful data
      const resultObj = call.result as Record<string, unknown> | undefined;
      const data = resultObj?.data || resultObj?.result || resultObj?.rows || resultObj;
      
      if (data !== undefined) {
        const hasData = data !== null &&
                       (typeof data !== 'object' || (Array.isArray(data) ? data.length > 0 : Object.keys(data as object).length > 0));
        details.push({
          field: `${call.tool}.data`,
          passed: hasData,
          message: hasData
            ? `Data operation returned valid data (${typeof data})`
            : 'Data operation returned empty data',
        });
        if (!hasData) score -= 25;
      }

      // 3. Check for error indicators in result
      const hasError = resultObj?.error || resultObj?.err || resultObj?.failed;
      if (hasError) {
        details.push({
          field: `${call.tool}.error`,
          passed: false,
          message: `Data operation returned an error: ${hasError}`,
        });
        score -= 25;
      }
    }

    score = Math.max(0, score);
    const status = score >= 80 ? 'passed' : score >= 50 ? 'partial' : 'failed';
    const message = status === 'passed'
      ? `Data verification passed (score: ${score}/100, ${dataCalls.length} operations checked)`
      : `Data verification ${status} (score: ${score}/100)`;

    return this.buildResult(claim.id, status, score, message, details, startTime);
  }

  private validateStructure(data: unknown, schema: Record<string, unknown>): boolean {
    if (typeof data !== 'object' || data === null) {
      return typeof data === schema.type;
    }

    const dataObj = data as Record<string, unknown>;
    const requiredFields = schema.required as string[] | undefined;

    if (requiredFields) {
      for (const field of requiredFields) {
        if (!(field in dataObj)) {
          return false;
        }
      }
    }

    return true;
  }

  private buildResult(
    claimId: string,
    status: VerificationResult['status'],
    score: number,
    message: string,
    details: VerificationResult['details'],
    startTime: number
  ): VerificationResult {
    return {
      id: uuidv4(),
      claimId,
      verifierType: this.type,
      status,
      score,
      message,
      details,
      timestamp: new Date(),
      durationMs: Date.now() - startTime,
      suggestedFix: status === 'failed'
        ? '检查数据操作是否正确返回数据，确认数据结构符合预期'
        : undefined,
    };
  }
}