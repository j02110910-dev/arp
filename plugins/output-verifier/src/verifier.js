"use strict";
/**
 * Output Verifier - Main Orchestrator
 * Coordinates verification of agent claims across multiple verifier types
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutputVerifier = void 0;
const fs = __importStar(require("fs"));
const uuid_1 = require("uuid");
const verifiers_1 = require("./verifiers");
class OutputVerifier {
    config;
    verifiers = new Map();
    reportHistory = [];
    constructor(config) {
        this.config = config;
        this.setupVerifiers();
        this.loadReportHistory();
    }
    setupVerifiers() {
        if (this.config.verifiers.schema?.enabled) {
            this.verifiers.set('schema', new verifiers_1.SchemaVerifier(this.config.verifiers.schema));
        }
        if (this.config.verifiers.api?.enabled) {
            this.verifiers.set('api', new verifiers_1.ApiVerifier(this.config.verifiers.api));
        }
        if (this.config.verifiers.data?.enabled) {
            this.verifiers.set('data', new verifiers_1.ApiVerifier(this.config.verifiers.data));
        }
        if (this.config.verifiers.screenshot?.enabled) {
            this.verifiers.set('screenshot', new verifiers_1.ScreenshotVerifier(this.config.verifiers.screenshot));
        }
        if (this.config.verifiers.e2e?.enabled) {
            this.verifiers.set('e2e', new verifiers_1.E2eVerifier(this.config.verifiers.e2e));
        }
    }
    /**
     * Verify an agent claim using all applicable verifiers
     */
    async verify(claim) {
        const startTime = Date.now();
        const results = [];
        for (const [type, verifier] of this.verifiers) {
            if (verifier.canVerify(claim)) {
                try {
                    const result = await verifier.verify(claim);
                    results.push(result);
                }
                catch (error) {
                    results.push({
                        id: (0, uuid_1.v4)(),
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
                id: (0, uuid_1.v4)(),
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
            }
            catch (error) {
                console.error('[OutputVerifier] Callback error:', error);
            }
        }
        return report;
    }
    /**
     * Quick verify: just check output against a schema
     */
    async verifyOutput(output, schema, requiredFields) {
        const claim = {
            id: (0, uuid_1.v4)(),
            timestamp: new Date(),
            description: 'Quick output verification',
            output,
        };
        // Temporarily configure schema verifier if schema provided
        if (schema || requiredFields) {
            const tempVerifier = new verifiers_1.SchemaVerifier({
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
    async verifyToolCalls(toolCalls, expectedTools) {
        const claim = {
            id: (0, uuid_1.v4)(),
            timestamp: new Date(),
            description: 'Tool call verification',
            toolCalls,
        };
        if (expectedTools && toolCalls) {
            const details = [];
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
                if (!found)
                    score -= 25;
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
                if (!hasResult)
                    score -= 15;
            }
            score = Math.max(0, score);
            const status = score >= 80 ? 'passed' : score >= 50 ? 'partial' : 'failed';
            return {
                id: (0, uuid_1.v4)(),
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
    getReports(limit = 10) {
        return this.reportHistory.slice(-limit);
    }
    /**
     * Get verification statistics
     */
    getStats() {
        const reports = this.reportHistory;
        let passed = 0;
        let failed = 0;
        let partial = 0;
        let totalScore = 0;
        for (const report of reports) {
            if (report.overallStatus === 'passed')
                passed++;
            else if (report.overallStatus === 'failed')
                failed++;
            else if (report.overallStatus === 'partial')
                partial++;
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
    clearHistory() {
        this.reportHistory = [];
        this.saveReportHistory();
    }
    buildReport(claim, results, startTime) {
        // Calculate overall status
        const statuses = results.map(r => r.status);
        let overallStatus;
        if (statuses.every(s => s === 'passed')) {
            overallStatus = 'passed';
        }
        else if (statuses.some(s => s === 'failed')) {
            overallStatus = 'failed';
        }
        else if (statuses.some(s => s === 'partial')) {
            overallStatus = 'partial';
        }
        else if (statuses.some(s => s === 'error')) {
            overallStatus = 'error';
        }
        else {
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
            id: (0, uuid_1.v4)(),
            claim,
            results,
            overallStatus,
            overallScore,
            timestamp: new Date(),
            totalDurationMs: Date.now() - startTime,
            summary,
        };
    }
    loadReportHistory() {
        if (!this.config.reportPath)
            return;
        try {
            if (fs.existsSync(this.config.reportPath)) {
                const data = fs.readFileSync(this.config.reportPath, 'utf-8');
                const reports = JSON.parse(data);
                this.reportHistory = reports.map((r) => ({
                    ...r,
                    timestamp: new Date(r.timestamp),
                    claim: {
                        ...r.claim,
                        timestamp: new Date(r.claim.timestamp),
                    },
                    results: r.results.map((vr) => ({
                        ...vr,
                        timestamp: new Date(vr.timestamp),
                    })),
                }));
                console.log(`[OutputVerifier] Loaded ${this.reportHistory.length} past reports`);
            }
        }
        catch (error) {
            console.error('[OutputVerifier] Failed to load report history:', error);
            this.reportHistory = [];
        }
    }
    saveReportHistory() {
        if (!this.config.reportPath)
            return;
        try {
            const toSave = this.reportHistory.slice(-(this.config.maxReports || 100));
            fs.writeFileSync(this.config.reportPath, JSON.stringify(toSave, null, 2));
        }
        catch (error) {
            console.error('[OutputVerifier] Failed to save report history:', error);
        }
    }
    /**
     * Stop the verifier and save state
     */
    stop() {
        this.saveReportHistory();
        console.log('[OutputVerifier] Verifier stopped');
    }
}
exports.OutputVerifier = OutputVerifier;
//# sourceMappingURL=verifier.js.map