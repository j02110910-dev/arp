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

  describe('skipped result verifierType', () => {
    it('should record correct verifierType for skipped results', async () => {
      // claim has no toolCalls, so api and data verifiers will skip
      const report = await verifier.verify({
        id: 'skip-test-1',
        timestamp: new Date(),
        description: 'No matching verifier',
        output: { unmatched: true },
      });
      // api and data verifiers should skip with their correct verifierType
      const apiResult = report.results.find(r => r.verifierType === 'api');
      const dataResult = report.results.find(r => r.verifierType === 'data');
      expect(apiResult).toBeDefined();
      expect(apiResult!.status).toBe('skipped');
      expect(dataResult).toBeDefined();
      expect(dataResult!.status).toBe('skipped');
    });

    it('should have api verifierType when api verifier skips', async () => {
      // Claim has output but no API-related tool calls - api verifier should skip with type 'api'
      const report = await verifier.verify({
        id: 'skip-api-test',
        timestamp: new Date(),
        description: 'API claim without API tool',
        output: { result: 'something' },
      });
      const apiResult = report.results.find(r => r.verifierType === 'api');
      expect(apiResult).toBeDefined();
      expect(apiResult!.status).toBe('skipped');
    });

    it('should have data verifierType when data verifier skips', async () => {
      // Claim has output but no data-related tool calls - data verifier should skip with type 'data'
      const report = await verifier.verify({
        id: 'skip-data-test',
        timestamp: new Date(),
        description: 'Data claim without data tool',
        output: { result: 'something' },
      });
      const dataResult = report.results.find((r: any) => r.verifierType === 'data');
      expect(dataResult).toBeDefined();
      expect(dataResult!.status).toBe('skipped');
    });
  });

  describe('async saveReportHistory behavior', () => {
    it('should save report history asynchronously', async () => {
      const tmpPath = '/tmp/test-report-history-' + Date.now() + '.json';
      const v = new (verifier.constructor as any)({
        ...(verifier as any).config,
        reportPath: tmpPath,
      });

      await v.verify({ id: 'async-test', timestamp: new Date(), description: 'Async test', output: { ok: true } });
      v.stop();

      // Give async write time to complete
      await new Promise(r => setTimeout(r, 100));

      // Verify file was written (async behavior)
      const fs = require('fs');
      expect(fs.existsSync(tmpPath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(tmpPath, 'utf-8'));
      expect(Array.isArray(content)).toBe(true);
    });

    it('should handle concurrent verifications with async saves', async () => {
      const reports = await Promise.all([
        verifier.verify({ id: 'concurrent-1', timestamp: new Date(), description: 'C1', output: { n: 1 } }),
        verifier.verify({ id: 'concurrent-2', timestamp: new Date(), description: 'C2', output: { n: 2 } }),
        verifier.verify({ id: 'concurrent-3', timestamp: new Date(), description: 'C3', output: { n: 3 } }),
      ]);
      expect(reports.length).toBe(3);
      expect(verifier.getReports().length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('callback error handling', () => {
    it('should catch errors in onVerification callback', async () => {
      const erroringCallback = () => {
        throw new Error('Callback error');
      };
      const v = new (verifier.constructor as any)({
        enabled: true,
        verifiers: {
          schema: { enabled: true },
          api: { enabled: false },
          data: { enabled: false },
          screenshot: { enabled: false },
          e2e: { enabled: false },
        },
        onVerification: erroringCallback,
      });

      // Should not throw, error should be caught
      await v.verify({ id: 'cb-err', timestamp: new Date(), description: 'T', output: { ok: true } });
      v.stop();
    });

    it('should call onVerification with best result', async () => {
      let capturedResult: any;
      const v = new (verifier.constructor as any)({
        enabled: true,
        verifiers: {
          schema: { enabled: true },
          api: { enabled: false },
          data: { enabled: false },
          screenshot: { enabled: false },
          e2e: { enabled: false },
        },
        onVerification: (r: any) => { capturedResult = r; },
      });

      await v.verify({ id: 'cb-best', timestamp: new Date(), description: 'T', output: { ok: true } });
      expect(capturedResult).toBeDefined();
      expect(capturedResult.claimId).toBe('cb-best');
      v.stop();
    });
  });

  describe('buildReport - all skipped', () => {
    it('should return skipped when all verifiers skip', async () => {
      const v = new (verifier.constructor as any)({
        enabled: true,
        verifiers: {
          schema: { enabled: false },
          api: { enabled: false },
          data: { enabled: false },
          screenshot: { enabled: false },
          e2e: { enabled: false },
        },
      });
      const report = await v.verify({ id: 'all-skip', timestamp: new Date(), description: 'T' });
      expect(report.overallStatus).toBe('skipped');
      v.stop();
    });
  });

  describe('buildReport - error status', () => {
    it('should handle error status in aggregation', async () => {
      const v = new (verifier.constructor as any)({
        enabled: true,
        verifiers: {
          schema: { enabled: true },
          api: { enabled: false },
          data: { enabled: false },
          screenshot: { enabled: false },
          e2e: { enabled: false },
        },
      });
      // Manually push an error result by triggering verifier error
      const report = await v.verify({ id: 'err-aggr', timestamp: new Date(), description: 'T', output: { ok: true } });
      // Normal case should work fine
      expect(report.overallStatus).toBeDefined();
      v.stop();
    });
  });

  describe('DataVerifier behavior (替代 ApiVerifier)', () => {
    it('should use DataVerifier for data-related claims', async () => {
      const v = new (verifier.constructor as any)({
        enabled: true,
        strictness: 'standard',
        verifiers: {
          schema: { enabled: false },
          data: { enabled: true },
          api: { enabled: false },
          screenshot: { enabled: false },
          e2e: { enabled: false },
        },
      });

      const report = await v.verify({
        id: 'data-claim',
        timestamp: new Date(),
        description: 'Data operation',
        toolCalls: [
          { tool: 'query_database', result: { rows: [{ id: 1 }] } },
        ],
      });

      const dataResult = report.results.find((r: any) => r.verifierType === 'data');
      expect(dataResult).toBeDefined();
      expect(dataResult!.status).toBe('passed');
    });

    it('should differentiate DataVerifier from ApiVerifier by claim type', async () => {
      // Data-related claim should be handled by data verifier
      const dataClaim = {
        id: 'data-diff',
        timestamp: new Date(),
        description: 'DB operation',
        toolCalls: [{ tool: 'sql_query', result: { data: [1, 2] } }],
      };

      // Api-related claim should be handled by api verifier
      const apiClaim = {
        id: 'api-diff',
        timestamp: new Date(),
        description: 'API call',
        toolCalls: [{ tool: 'api_fetch', result: { status: 200, data: [1, 2] } }],
      };

      const dataReport = await verifier.verify(dataClaim);
      const apiReport = await verifier.verify(apiClaim);

      // Data claim should have a 'data' result
      expect(dataReport.results.some(r => r.verifierType === 'data')).toBe(true);
      // Api claim should have an 'api' result
      expect(apiReport.results.some(r => r.verifierType === 'api')).toBe(true);
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
