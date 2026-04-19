/**
 * E2E Verifier
 * Runs test cases against agent output to verify correctness
 */

import { v4 as uuidv4 } from 'uuid';
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

export class E2eVerifier implements Verifier {
  type: VerifierType = 'e2e';
  name = 'E2E Verifier';

  private config: VerifierConfig;
  private testSuites: Map<string, E2ETestSuite> = new Map();

  constructor(config: VerifierConfig) {
    this.config = config;
    this.registerBuiltInTests();
  }

  canVerify(claim: AgentClaim): boolean {
    // E2E verifier can verify any claim with output or tool calls
    return claim.output !== undefined || (claim.toolCalls !== undefined && claim.toolCalls.length > 0);
  }

  async verify(claim: AgentClaim): Promise<VerificationResult> {
    const startTime = Date.now();
    const details: VerificationResult['details'] = [];

    // Get all applicable test cases
    const applicableTests = this.getApplicableTests(claim);

    if (applicableTests.length === 0) {
      return this.buildResult(claim.id, 'skipped', 100,
        'No applicable E2E tests found for this claim', details, startTime);
    }

    // Run each test
    let passed = 0;
    let failed = 0;
    let hasVetoFailure = false;
    const testOutput: string[] = [];

    for (const test of applicableTests) {
      if (test.skip) {
        testOutput.push(`⏭️  SKIP: ${test.name} - ${test.description}`);
        continue;
      }

      try {
        const result = test.assert(claim);
        if (result.passed) {
          passed++;
          testOutput.push(`✅ PASS: ${test.name} - ${result.message}`);
          details.push({
            field: test.name,
            expected: result.expected,
            actual: result.actual,
            passed: true,
            message: result.message,
          });
        } else {
          failed++;
          if (test.veto) hasVetoFailure = true;
          const vetoTag = test.veto ? ' 🚫 VETO' : '';
          testOutput.push(`❌ FAIL: ${test.name}${vetoTag} - ${result.message}`);
          details.push({
            field: test.name,
            expected: result.expected,
            actual: result.actual,
            passed: false,
            message: result.message + (test.veto ? ' [VETO]' : ''),
          });
        }
      } catch (err) {
        failed++;
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        testOutput.push(`💥 ERROR: ${test.name} - ${errMsg}`);
        details.push({
          field: test.name,
          passed: false,
          message: `Test threw error: ${errMsg}`,
        });
      }
    }

    const total = passed + failed;
    const score = total > 0 ? Math.round((passed / total) * 100) : 100;
    // Veto: any veto test failure forces overall status to 'failed'
    let status: VerificationResult['status'];
    if (hasVetoFailure) {
      status = 'failed';
    } else {
      status = score >= 80 ? 'passed' : score >= 50 ? 'partial' : 'failed';
    }
    const message = `E2E: ${passed}/${total} tests passed (score: ${score}/100)${hasVetoFailure ? ' [VETO FAILED]' : ''}`;

    return this.buildResult(claim.id, status, score, message, details, startTime, testOutput.join('\n'));
  }

  /**
   * Register a custom test suite
   */
  registerTestSuite(suite: E2ETestSuite): void {
    this.testSuites.set(suite.name, suite);
  }

  /**
   * Add a single test case
   */
  addTest(name: string, test: Omit<E2ETestCase, 'name'>): void {
    let customSuite = this.testSuites.get('custom');
    if (!customSuite) {
      customSuite = { name: 'custom', description: 'User-defined tests', tests: [] };
      this.testSuites.set('custom', customSuite);
    }
    customSuite.tests.push({ name, ...test });
  }

  /**
   * Get all test suites
   */
  getTestSuites(): E2ETestSuite[] {
    return Array.from(this.testSuites.values());
  }

  private getApplicableTests(claim: AgentClaim): E2ETestCase[] {
    const tests: E2ETestCase[] = [];
    for (const suite of this.testSuites.values()) {
      tests.push(...suite.tests);
    }
    return tests;
  }

  private registerBuiltInTests(): void {
    // Built-in generic tests that apply to any claim
    const builtIn: E2ETestSuite = {
      name: 'built-in',
      description: 'Generic verification tests',
      tests: [
        {
          name: 'output_exists',
          description: 'Verify agent produced some output',
          assert: (claim) => {
            const hasOutput = claim.output !== undefined && claim.output !== null;
            return {
              passed: hasOutput,
              message: hasOutput ? 'Agent produced output' : 'Agent output is null/undefined',
              expected: 'non-null output',
              actual: claim.output,
            };
          },
        },
        {
          name: 'output_not_empty',
          description: 'Verify output is not empty',
          assert: (claim) => {
            if (claim.output === undefined || claim.output === null) {
              return { passed: false, message: 'No output to check' };
            }
            if (typeof claim.output === 'string' && claim.output.trim() === '') {
              return { passed: false, message: 'Output is empty string', expected: 'non-empty', actual: '' };
            }
            if (typeof claim.output === 'object' && !Array.isArray(claim.output) && Object.keys(claim.output as object).length === 0) {
              return { passed: false, message: 'Output is empty object', expected: 'non-empty', actual: {} };
            }
            if (Array.isArray(claim.output) && claim.output.length === 0) {
              return { passed: false, message: 'Output is empty array', expected: 'non-empty', actual: [] };
            }
            return { passed: true, message: 'Output is not empty' };
          },
        },
        {
          name: 'tool_calls_have_results',
          description: 'Verify all tool calls returned results',
          assert: (claim) => {
            if (!claim.toolCalls || claim.toolCalls.length === 0) {
              return { passed: true, message: 'No tool calls to check' };
            }
            const missing = claim.toolCalls.filter(tc => tc.result === undefined || tc.result === null);
            if (missing.length > 0) {
              return {
                passed: false,
                message: `${missing.length} tool call(s) have no result: ${missing.map(tc => tc.tool).join(', ')}`,
                expected: 'all tool calls have results',
                actual: `${missing.length} missing`,
              };
            }
            return { passed: true, message: `All ${claim.toolCalls.length} tool calls have results` };
          },
        },
        {
          name: 'no_error_in_output',
          description: 'Check output does not contain error indicators (veto: fails entire verification)',
          veto: true,
          assert: (claim) => {
            if (typeof claim.output === 'string') {
              const output = claim.output;
              const errorPatterns = ['Error:', 'error:', 'ERROR', 'Exception', 'failed', 'Failed'];
              const found = errorPatterns.filter(p => output.includes(p));
              if (found.length > 0) {
                return {
                  passed: false,
                  message: `Output contains error indicators: ${found.join(', ')}`,
                  expected: 'clean output',
                  actual: `found: ${found.join(', ')}`,
                };
              }
            }
            return { passed: true, message: 'No error indicators in output' };
          },
        },
        {
          name: 'claim_has_description',
          description: 'Agent claim includes a description',
          assert: (claim) => {
            const hasDesc = !!claim.description && claim.description.length > 0;
            return {
              passed: hasDesc,
              message: hasDesc ? 'Claim has description' : 'Claim is missing description',
            };
          },
        },
        {
          name: 'tool_call_chain_makes_sense',
          description: 'Verify tool calls form a logical sequence',
          assert: (claim) => {
            if (!claim.toolCalls || claim.toolCalls.length < 2) {
              return { passed: true, message: 'Less than 2 tool calls, chain check skipped' };
            }
            // Check if all tool calls have timestamps and are in order
            const withTimestamps = claim.toolCalls.filter(tc => tc.timestamp);
            if (withTimestamps.length > 1) {
              for (let i = 1; i < withTimestamps.length; i++) {
                if (withTimestamps[i].timestamp! < withTimestamps[i - 1].timestamp!) {
                  return {
                    passed: false,
                    message: `Tool call order violation: "${withTimestamps[i].tool}" timestamp is before "${withTimestamps[i - 1].tool}"`,
                  };
                }
              }
            }
            return { passed: true, message: 'Tool call chain is logically ordered' };
          },
        },
      ],
    };

    this.testSuites.set('built-in', builtIn);
  }

  private buildResult(
    claimId: string,
    status: VerificationResult['status'],
    score: number,
    message: string,
    details: VerificationResult['details'],
    startTime: number,
    testOutput?: string
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
        ? 'E2E 测试未通过：检查 Agent 输出是否符合预期，工具调用是否都有返回值'
        : undefined,
      evidence: testOutput ? { testOutput } : undefined,
    };
  }
}
