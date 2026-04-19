/**
 * E2E Verifier Tests
 */

import { E2eVerifier } from '../src/verifiers/e2eVerifier';
import { AgentClaim } from '../src/types';

function createClaim(overrides: Partial<AgentClaim> = {}): AgentClaim {
  return {
    id: 'test-claim',
    timestamp: new Date(),
    description: 'Test claim',
    output: { userId: 42 },
    toolCalls: [{ tool: 'create_user', result: { id: 42 } }],
    ...overrides,
  };
}

describe('E2eVerifier', () => {
  let verifier: E2eVerifier;

  beforeEach(() => {
    verifier = new E2eVerifier({ enabled: true });
  });

  describe('built-in tests', () => {
    it('should pass all built-in tests for a good claim', async () => {
      const result = await verifier.verify(createClaim());
      expect(result.status).toBe('passed');
      expect(result.score).toBe(100);
    });

    it('should fail output_exists for null output', async () => {
      const result = await verifier.verify(createClaim({ output: null }));
      expect(result.score).toBeLessThan(100);
      expect(result.details.some(d => d.field === 'output_exists' && !d.passed)).toBe(true);
    });

    it('should fail output_not_empty for empty string', async () => {
      const result = await verifier.verify(createClaim({ output: '' }));
      expect(result.details.some(d => d.field === 'output_not_empty' && !d.passed)).toBe(true);
    });

    it('should fail output_not_empty for empty object', async () => {
      const result = await verifier.verify(createClaim({ output: {} }));
      expect(result.details.some(d => d.field === 'output_not_empty' && !d.passed)).toBe(true);
    });

    it('should fail output_not_empty for empty array', async () => {
      const result = await verifier.verify(createClaim({ output: [] }));
      expect(result.details.some(d => d.field === 'output_not_empty' && !d.passed)).toBe(true);
    });

    it('should fail tool_calls_have_results when tool has no result', async () => {
      const result = await verifier.verify(createClaim({
        toolCalls: [
          { tool: 'search', args: {} },
          { tool: 'update', args: {}, result: { ok: true } },
        ],
      }));
      expect(result.details.some(d => d.field === 'tool_calls_have_results' && !d.passed)).toBe(true);
    });

    it('should detect error indicators in output (veto)', async () => {
      const result = await verifier.verify(createClaim({
        output: 'Error: something went wrong',
      }));
      // Veto should force status to failed
      expect(result.status).toBe('failed');
      expect(result.message).toContain('VETO');
    });

    it('should detect Exception in output (veto)', async () => {
      const result = await verifier.verify(createClaim({
        output: 'Exception: null pointer',
      }));
      expect(result.status).toBe('failed');
    });

    it('should pass no_error_in_output for clean output', async () => {
      const result = await verifier.verify(createClaim({
        output: 'Successfully created user',
      }));
      expect(result.details.find(d => d.field === 'no_error_in_output')?.passed).toBe(true);
    });

    it('should skip claim_has_description when description exists', async () => {
      const result = await verifier.verify(createClaim({ description: 'Created user' }));
      expect(result.details.find(d => d.field === 'claim_has_description')?.passed).toBe(true);
    });

    it('should fail claim_has_description when missing', async () => {
      const result = await verifier.verify(createClaim({ description: '' }));
      expect(result.details.find(d => d.field === 'claim_has_description' && !d.passed)).toBeDefined();
    });
  });

  describe('custom tests', () => {
    it('should run custom tests', async () => {
      verifier.addTest('has_user_id', {
        description: 'Must have userId',
        assert: (claim) => {
          const has = claim.output && typeof claim.output === 'object' && 'userId' in (claim.output as object);
          return { passed: !!has, message: has ? 'has userId' : 'missing userId' };
        },
      });

      const result = await verifier.verify(createClaim({ output: { userId: 1 } }));
      expect(result.details.find(d => d.field === 'has_user_id')?.passed).toBe(true);
    });

    it('should fail custom test when assertion fails', async () => {
      verifier.addTest('status_ok', {
        description: 'Status must be ok',
        assert: (claim) => {
          const obj = claim.output as Record<string, unknown> | undefined;
          return { passed: obj?.status === 'ok', message: 'status check' };
        },
      });

      const result = await verifier.verify(createClaim({ output: { status: 'failed' } }));
      expect(result.details.find(d => d.field === 'status_ok' && !d.passed)).toBeDefined();
    });

    it('should support veto in custom tests', async () => {
      verifier.addTest('critical_check', {
        description: 'Critical check',
        veto: true,
        assert: () => ({ passed: false, message: 'always fails' }),
      });

      const result = await verifier.verify(createClaim());
      expect(result.status).toBe('failed');
      expect(result.message).toContain('VETO');
    });
  });

  describe('canVerify', () => {
    it('should verify claims with output', () => {
      expect(verifier.canVerify(createClaim({ output: 'test' }))).toBe(true);
    });

    it('should verify claims with toolCalls', () => {
      expect(verifier.canVerify(createClaim({ output: undefined, toolCalls: [{ tool: 'x', result: 1 }] }))).toBe(true);
    });

    it('should not verify empty claims', () => {
      expect(verifier.canVerify(createClaim({ output: undefined, toolCalls: undefined }))).toBe(false);
    });
  });

  describe('test suites', () => {
    it('should register and list test suites', () => {
      const suites = verifier.getTestSuites();
      expect(suites.length).toBeGreaterThanOrEqual(1);
      expect(suites.find(s => s.name === 'built-in')).toBeDefined();
    });
  });
});
