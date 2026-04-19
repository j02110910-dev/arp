/**
 * Screenshot Verifier
 * Uses AI vision models to analyze screenshots and verify agent claims
 */
import { Verifier, VerifierType, AgentClaim, VerificationResult, ScreenshotVerifierConfig } from '../types';
export declare class ScreenshotVerifier implements Verifier {
    type: VerifierType;
    name: string;
    private config;
    private apiEndpoint;
    private model;
    constructor(config: ScreenshotVerifierConfig);
    canVerify(claim: AgentClaim): boolean;
    verify(claim: AgentClaim): Promise<VerificationResult>;
    private getScreenshotPath;
    private buildAnalysisPrompt;
    private callVisionModel;
    private parseAnalysis;
    private getMimeType;
    private buildResult;
}
