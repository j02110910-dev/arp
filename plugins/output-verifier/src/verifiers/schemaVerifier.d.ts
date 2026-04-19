/**
 * Schema Verifier
 * Validates agent output against JSON Schema or custom rules
 */
import { Verifier, VerifierType, AgentClaim, VerificationResult, SchemaVerifierConfig } from '../types';
export declare class SchemaVerifier implements Verifier {
    type: VerifierType;
    name: string;
    private config;
    constructor(config: SchemaVerifierConfig);
    canVerify(claim: AgentClaim): boolean;
    verify(claim: AgentClaim): Promise<VerificationResult>;
    private validateAgainstSchema;
    private safeParseJSON;
    private buildResult;
}
