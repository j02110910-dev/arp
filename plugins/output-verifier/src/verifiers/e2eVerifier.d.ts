/**
 * E2E Verifier
 * Runs test cases against agent output to verify correctness
 */
import { Verifier, VerifierType, AgentClaim, VerificationResult, VerifierConfig } from '../types';
/** A single test case for E2E verification */
export interface E2ETestCase {
    /** Test case name */
    name: string;
    /** Description of what this test checks */
    description: string;
    /** The assertion function - receives the claim, returns pass/fail + message */
    assert: (claim: AgentClaim) => E2EAssertionResult;
    /** Optional: skip this test */
    skip?: boolean;
    /** If true, this test failing will force overall status to 'failed' regardless of score */
    veto?: boolean;
}
/** Result of a single assertion */
export interface E2EAssertionResult {
    passed: boolean;
    message: string;
    expected?: unknown;
    actual?: unknown;
}
/** A preset test suite */
export interface E2ETestSuite {
    name: string;
    description: string;
    tests: E2ETestCase[];
}
export declare class E2eVerifier implements Verifier {
    type: VerifierType;
    name: string;
    private config;
    private testSuites;
    constructor(config: VerifierConfig);
    canVerify(claim: AgentClaim): boolean;
    verify(claim: AgentClaim): Promise<VerificationResult>;
    /**
     * Register a custom test suite
     */
    registerTestSuite(suite: E2ETestSuite): void;
    /**
     * Add a single test case
     */
    addTest(name: string, test: Omit<E2ETestCase, 'name'>): void;
    /**
     * Get all test suites
     */
    getTestSuites(): E2ETestSuite[];
    private getApplicableTests;
    private registerBuiltInTests;
    private buildResult;
}
