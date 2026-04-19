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
});
