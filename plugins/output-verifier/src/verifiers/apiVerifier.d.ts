/**
 * API Verifier
 * Verifies agent claims by making independent API calls
 */
import { Verifier, VerifierType, AgentClaim, VerificationResult, DataVerifierConfig } from '../types';
export declare class ApiVerifier implements Verifier {
    type: VerifierType;
    name: string;
    private config;
    constructor(config: DataVerifierConfig);
    canVerify(claim: AgentClaim): boolean;
    verify(claim: AgentClaim): Promise<VerificationResult>;
    private buildResult;
}
