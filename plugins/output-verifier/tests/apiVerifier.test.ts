/**
 * API Verifier Tests
 */

import { ApiVerifier } from '../src/verifiers/apiVerifier';
import { AgentClaim } from '../src/types';

function createClaim(toolCalls: AgentClaim['toolCalls']): AgentClaim {
  return {
    id: 'test-claim',
    timestamp: new Date(),
    description: 'Test',
    toolCalls,
  };
}

describe('ApiVerifier', () => {
  let verifier: ApiVerifier;

  beforeEach(() => {
    verifier = new ApiVerifier({ enabled: true });
  });

  describe('canVerify', () => {
    it('should verify claims with api-related tool calls', () => {
      expect(verifier.canVerify(createClaim([{ tool: 'api_call', result: {} }]))).toBe(true);
      expect(verifier.canVerify(createClaim([{ tool: 'fetch_data', result: {} }]))).toBe(true);
      expect(verifier.canVerify(createClaim([{ tool: 'http_request', result: {} }]))).toBe(true);
      expect(verifier.canVerify(createClaim([{ tool: 'get_users', result: {} }]))).toBe(true);
    });

    it('should not verify claims without api tool calls', () => {
      expect(verifier.canVerify(createClaim([{ tool: 'search_db', result: {} }]))).toBe(false);
      expect(verifier.canVerify(createClaim([]))).toBe(false);
    });

    it('should verify when tool has url arg', () => {
      expect(verifier.canVerify(createClaim([{ tool: 'custom', args: { url: 'https://api.example.com' } }]))).toBe(true);
    });
  });

  describe('verification', () => {
    it('should skip when no api calls found', async () => {
      const result = await verifier.verify(createClaim([{ tool: 'search', result: {} }]));
      expect(result.status).toBe('skipped');
    });

    it('should pass when api call has result', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'api_call', result: { status: 200, data: { id: 1 } } },
      ]));
      expect(result.status).toBe('passed');
      expect(result.score).toBe(100);
    });

    it('should fail when api call has no result', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'api_call', result: null },
      ]));
      expect(result.score).toBeLessThan(100);
    });

    it('should check status codes', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'api_call', result: { status: 500 } },
      ]));
      expect(result.score).toBeLessThan(100);
      expect(result.details.some(d => d.field.includes('status') && !d.passed)).toBe(true);
    });

    it('should pass for success status codes', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'api_call', result: { status: 200, data: { ok: true } } },
      ]));
      expect(result.status).toBe('passed');
    });

    it('should handle statusCode field', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'api_call', result: { statusCode: 201, data: { created: true } } },
      ]));
      expect(result.status).toBe('passed');
    });

    it('should check response time', async () => {
      const verifierWithTimeout = new ApiVerifier({ enabled: true, timeoutMs: 100 });
      const result = await verifierWithTimeout.verify(createClaim([
        { tool: 'api_call', result: { data: {} }, duration: 500 },
      ]));
      expect(result.details.some(d => d.field.includes('duration') && !d.passed)).toBe(true);
    });

    it('should handle multiple api calls', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'api_get', result: { status: 200, data: { users: [1, 2] } } },
        { tool: 'api_post', result: { status: 201, data: { created: true } } },
      ]));
      expect(result.status).toBe('passed');
    });

    it('should handle mixed results', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'api_get', result: { status: 200, data: {} } },
        { tool: 'api_post', result: { status: 500 } },
      ]));
      expect(result.score).toBeLessThan(100);
    });
  });

  describe('Error handling', () => {
    it('should handle Error instance as result', async () => {
      const err = new Error('Connection refused');
      const result = await verifier.verify(createClaim([
        { tool: 'api_call', result: err },
      ]));
      // Error instance is not null/undefined, so first check passes
      // Then instanceof Error check deducts 30 -> score 70, status 'partial'
      expect(result.status).toBe('partial');
      expect(result.score).toBe(70);
      // Should contain detail about the error
      expect(result.details.some(d => d.message.includes('Connection refused'))).toBe(true);
    });

    it('should deduct 30 points for Error result', async () => {
      const err = new Error('Timeout');
      const result = await verifier.verify(createClaim([
        { tool: 'api_call', result: err },
      ]));
      // Error: only the instanceof Error check applies (not null check)
      // Score = 100 - 30 = 70
      expect(result.score).toBe(70);
    });

    it('should handle multiple Error instances', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'api_call', result: new Error('Err 1') },
        { tool: 'fetch_data', result: new Error('Err 2') },
      ]));
      // Each Error deducts 30 -> 100 - 60 = 40 -> 'failed' (< 50)
      expect(result.status).toBe('failed');
      expect(result.score).toBe(40);
    });

    it('should handle null result (not Error instance)', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'api_call', result: null },
      ]));
      expect(result.score).toBeLessThan(100);
      // Should not have Error-related message
      expect(result.details.some(d => d.message.includes('returned an error'))).toBe(false);
    });

    it('should handle undefined result', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'api_call', result: undefined },
      ]));
      expect(result.score).toBeLessThan(100);
    });
  });

  describe('30 point deduction (扣分30)', () => {
    it('should deduct 30 points for null result', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'api_call', result: null },
      ]));
      // Score should be 100 - 30 = 70
      expect(result.score).toBe(70);
      expect(result.details).toContainEqual(
        expect.objectContaining({
          passed: false,
          message: expect.stringContaining('returned no result'),
        })
      );
    });

    it('should deduct 30 points for Error result', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'api_call', result: new Error('API Error') },
      ]));
      // Error: -30 -> score 70
      expect(result.score).toBe(70);
    });

    it('should deduct 30 points for failed status code', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'api_call', result: { status: 500 } },
      ]));
      // failed status: -30 -> score 70
      expect(result.score).toBe(70);
    });

    it('should deduct 30 points for live check failure', async () => {
      // Use a verifier with baseUrl pointing to unreachable endpoint
      const v = new ApiVerifier({
        enabled: true,
        baseUrl: 'http://localhost:99999', // Unreachable port
        timeoutMs: 100,
      });
      const result = await v.verify(createClaim([
        { tool: 'api_call', args: { url: '/test' }, result: { status: 200, data: {} } },
      ]));
      expect(result.score).toBeLessThan(85); // At least -15 for live check failure
    });

    it('should combine multiple 30-point deductions', async () => {
      // null result (-30) + error (-30) = score 40 or less
      const result = await verifier.verify(createClaim([
        { tool: 'api_call', result: null },
        { tool: 'api_post', result: new Error('Failed') },
      ]));
      expect(result.score).toBeLessThanOrEqual(40);
    });
  });

  describe('configurable suggested fix message (可配置建议消息)', () => {
    it('should not have suggestedFix for partial status', async () => {
      const v = new ApiVerifier({ enabled: true });
      // Single Error: score 70 -> 'partial' -> no suggestedFix
      const result = await v.verify(createClaim([
        { tool: 'api_call', result: new Error('test') },
      ]));
      expect(result.status).toBe('partial');
      expect(result.suggestedFix).toBeUndefined();
    });

    it('should use custom suggestedFixMessage for failed status', async () => {
      const customMessage = 'Please check your network connection and try again';
      const v = new ApiVerifier({
        enabled: true,
        suggestedFixMessage: customMessage,
      });
      // Multiple errors: score 40 -> 'failed' -> should have suggestedFix
      const result = await v.verify(createClaim([
        { tool: 'api_call', result: new Error('Err 1') },
        { tool: 'fetch_data', result: new Error('Err 2') },
      ]));
      expect(result.status).toBe('failed');
      expect(result.suggestedFix).toBe(customMessage);
    });

    it('should use default message for failed status when not configured', async () => {
      const v = new ApiVerifier({ enabled: true });
      const result = await v.verify(createClaim([
        { tool: 'api_call', result: new Error('Err 1') },
        { tool: 'fetch_data', result: new Error('Err 2') },
      ]));
      expect(result.status).toBe('failed');
      expect(result.suggestedFix).toBeDefined();
      expect(typeof result.suggestedFix).toBe('string');
    });

    it('should not have suggestedFix for passed verification', async () => {
      const v = new ApiVerifier({
        enabled: true,
        suggestedFixMessage: 'Should not appear',
      });
      const result = await v.verify(createClaim([
        { tool: 'api_call', result: { status: 200, data: { ok: true } } },
      ]));
      expect(result.suggestedFix).toBeUndefined();
    });

    it('should not have suggestedFix for skipped verification', async () => {
      const v = new ApiVerifier({
        enabled: true,
        suggestedFixMessage: 'Should not appear',
      });
      const result = await v.verify(createClaim([
        { tool: 'search', result: {} }, // Not API-related
      ]));
      expect(result.suggestedFix).toBeUndefined();
    });
  });
});
