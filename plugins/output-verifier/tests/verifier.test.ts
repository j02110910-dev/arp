/**
 * Output Verifier Orchestrator Tests
 */

import { OutputVerifier } from '../src/verifier';
import { AgentClaim, loadConfig } from '../src';

describe('OutputVerifier', () => {
  let verifier: OutputVerifier;

  beforeEach(() => {
    const config = loadConfig();
    config.reportPath = undefined; // Don't save to disk in tests
    verifier = new OutputVerifier(config);
  });

  afterEach(() => {
    verifier.stop();
  });

  describe('verify', () => {
    it('should verify a complete claim', async () => {
      const report = await verifier.verify({
        id: 'test-1',
        timestamp: new Date(),
        description: 'Created user',
        output: { userId: 42, name: 'Alice' },
        toolCalls: [
          { tool: 'create_user', result: { id: 42 } },
        ],
      });
      expect(report.overallStatus).toBe('passed');
      expect(report.overallScore).toBeGreaterThan(0);
      expect(report.results.length).toBeGreaterThan(0);
    });

    it('should handle claims with no output', async () => {
      const report = await verifier.verify({
        id: 'test-2',
        timestamp: new Date(),
        description: 'Did something',
      });
      expect(report.overallStatus).toBe('skipped');
    });

    it('should aggregate multiple verifier results', async () => {
      const report = await verifier.verify({
        id: 'test-3',
        timestamp: new Date(),
        description: 'API call and data return',
        output: { data: [1, 2, 3] },
        toolCalls: [
          { tool: 'api_fetch', result: { status: 200, data: [1, 2, 3] } },
        ],
      });
      // Should have results from both schema and api verifiers
      expect(report.results.length).toBeGreaterThanOrEqual(1);
    });

    it('should include context snapshot in report', async () => {
      const report = await verifier.verify({
        id: 'test-4',
        timestamp: new Date(),
        description: 'Test',
        output: { ok: true },
      });
      expect(report.claim).toBeDefined();
      expect(report.claim.id).toBe('test-4');
    });
  });

  describe('verifyOutput', () => {
    it('should quick-verify output with schema', async () => {
      const result = await verifier.verifyOutput(
        { name: 'Alice', age: 30 },
        { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }
      );
      expect(result.status).toBe('passed');
    });

    it('should quick-verify output with required fields', async () => {
      const result = await verifier.verifyOutput(
        { id: 1, status: 'ok' },
        undefined,
        ['id', 'status']
      );
      expect(result.status).toBe('passed');
    });

    it('should detect missing required fields', async () => {
      const result = await verifier.verifyOutput(
        { id: 1 },
        undefined,
        ['id', 'status']
      );
      expect(result.status).not.toBe('passed');
    });
  });

  describe('verifyToolCalls', () => {
    it('should verify expected tools were called', async () => {
      const result = await verifier.verifyToolCalls([
        { tool: 'search', result: [1] },
        { tool: 'update', result: { ok: true } },
      ], ['search', 'update']);
      expect(result.status).toBe('passed');
    });

    it('should detect missing tool calls', async () => {
      const result = await verifier.verifyToolCalls([
        { tool: 'search', result: [1] },
      ], ['search', 'update']);
      expect(result.status).not.toBe('passed');
    });

    it('should detect tool calls without results', async () => {
      const result = await verifier.verifyToolCalls([
        { tool: 'search', result: [1] },
        { tool: 'update' },
      ], ['search', 'update']);
      expect(result.score).toBeLessThan(100);
    });
  });

  describe('report history', () => {
    it('should track report history', async () => {
      await verifier.verify({ id: 'r1', timestamp: new Date(), description: 'Test', output: { a: 1 } });
      await verifier.verify({ id: 'r2', timestamp: new Date(), description: 'Test', output: { b: 2 } });

      const reports = verifier.getReports(10);
      expect(reports.length).toBe(2);
      expect(reports[0].claim.id).toBe('r1');
      expect(reports[1].claim.id).toBe('r2');
    });

    it('should get stats', async () => {
      await verifier.verify({ id: 's1', timestamp: new Date(), description: 'T', output: { ok: true } });
      const stats = verifier.getStats();
      expect(stats.totalVerifications).toBe(1);
      expect(stats.passed).toBe(1);
    });

    it('should clear history', async () => {
      await verifier.verify({ id: 'c1', timestamp: new Date(), description: 'T', output: { x: 1 } });
      verifier.clearHistory();
      expect(verifier.getReports().length).toBe(0);
    });
  });
});
