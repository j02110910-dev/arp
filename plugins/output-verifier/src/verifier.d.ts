/**
 * Output Verifier - Main Orchestrator
 * Coordinates verification of agent claims across multiple verifier types
 */
import { OutputVerifierConfig, AgentClaim, VerificationResult, VerificationReport } from './types';
export declare class OutputVerifier {
    private config;
    private verifiers;
    private reportHistory;
    constructor(config: OutputVerifierConfig);
    private setupVerifiers;
    /**
     * Verify an agent claim using all applicable verifiers
     */
    verify(claim: AgentClaim): Promise<VerificationReport>;
    /**
     * Quick verify: just check output against a schema
     */
    verifyOutput(output: unknown, schema?: Record<string, unknown>, requiredFields?: string[]): Promise<VerificationResult>;
    /**
     * Verify tool calls were successful
     */
    verifyToolCalls(toolCalls: AgentClaim['toolCalls'], expectedTools?: string[]): Promise<VerificationResult>;
    /**
     * Get verification history
     */
    getReports(limit?: number): VerificationReport[];
    /**
     * Get verification statistics
     */
    getStats(): {
        totalVerifications: number;
        passed: number;
        failed: number;
        partial: number;
        averageScore: number;
    };
    /**
     * Clear report history
     */
    clearHistory(): void;
    private buildReport;
    private loadReportHistory;
    private saveReportHistory;
    /**
     * Stop the verifier and save state
     */
    stop(): void;
}
