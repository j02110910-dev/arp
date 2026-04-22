/**
 * Additional Coverage Tests - Cover uncovered branches
 */

import { OutputVerifier } from '../src/verifier';
import { SchemaVerifier } from '../src/verifiers/schemaVerifier';
import { E2eVerifier } from '../src/verifiers/e2eVerifier';
import { DataVerifier } from '../src/verifiers/dataVerifier';
import { AgentClaim, loadConfig } from '../src';
import * as fs from 'fs';
import * as path from 'path';

describe('Additional Coverage - verifier.ts branches', () => {
  describe('verify with error handling', () => {
    it('should handle verifier throwing error', async () => {
      const config = loadConfig();
      config.reportPath = undefined;
      const verifier = new OutputVerifier(config);

      // Create a mock verifier that throws
      const originalVerify = (verifier as any).verifiers.get('schema');
      (verifier as any).verifiers.set('schema', {
        canVerify: () => true,
        verify: () => { throw new Error('Test error'); }
      });

      const report = await verifier.verify({
        id: 'error-test',
        timestamp: new Date(),
        description: 'Test',
        output: { ok: true },
      });

      // Should have an error result
      const errorResult = report.results.find(r => r.status === 'error');
      expect(errorResult).toBeDefined();
      expect(errorResult!.message).toContain('Test error');

      (verifier as any).verifiers.set('schema', originalVerify);
      verifier.stop();
    });
  });

  describe('verifyOutput fallback path', () => {
    it('should fall back to default verifiers when no schema or requiredFields provided', async () => {
      const config = loadConfig();
      config.reportPath = undefined;
      const verifier = new OutputVerifier(config);

      // Call verifyOutput without schema or requiredFields - should fall to verify()
      const result = await verifier.verifyOutput({ test: 'data' });

      // Should return first result from the verification
      expect(result).toBeDefined();
      expect(result.verifierType).toBeDefined();

      verifier.stop();
    });
  });

  describe('verifyToolCalls fallback path', () => {
    it('should fall back to verify when expectedTools not provided', async () => {
      const config = loadConfig();
      config.reportPath = undefined;
      const verifier = new OutputVerifier(config);

      // Call with toolCalls but no expectedTools - should fall to verify()
      const result = await verifier.verifyToolCalls([
        { tool: 'test', result: { ok: true } }
      ]);

      // Should return a result from the verification
      expect(result).toBeDefined();

      verifier.stop();
    });
  });

  describe('buildReport error status handling', () => {
    it('should handle error status in result aggregation', async () => {
      const config = loadConfig();
      config.reportPath = undefined;
      const verifier = new OutputVerifier(config);

      // Create claim that would have mixed results including error
      const report = await verifier.verify({
        id: 'error-aggr-test',
        timestamp: new Date(),
        description: 'Test with schema',
        output: { ok: true },
      });

      // The buildReport should properly handle error statuses
      expect(report.overallStatus).toBeDefined();
      verifier.stop();
    });
  });

  describe('loadReportHistory error handling', () => {
    it('should handle corrupt report history file', async () => {
      const tmpPath = '/tmp/corrupt-report-' + Date.now() + '.json';
      fs.writeFileSync(tmpPath, '{ invalid json }');

      const config = loadConfig();
      config.reportPath = tmpPath;

      // Should not throw, should handle error gracefully
      const verifier = new OutputVerifier(config);
      expect(verifier.getReports().length).toBe(0);

      verifier.stop();
      fs.unlinkSync(tmpPath);
    });

    it('should load valid report history', async () => {
      const tmpPath = '/tmp/valid-report-' + Date.now() + '.json';
      const reportData = [{
        id: 'test-report',
        claim: { id: 'c1', timestamp: new Date().toISOString() },
        results: [],
        overallStatus: 'passed',
        overallScore: 100,
        timestamp: new Date().toISOString(),
        totalDurationMs: 10,
        summary: 'Test',
      }];
      fs.writeFileSync(tmpPath, JSON.stringify(reportData));

      const config = loadConfig();
      config.reportPath = tmpPath;

      const verifier = new OutputVerifier(config);
      const reports = verifier.getReports();
      expect(reports.length).toBe(1);

      verifier.stop();
      fs.unlinkSync(tmpPath);
    });
  });

  describe('saveReportHistory error handling', () => {
    it('should handle save error gracefully', async () => {
      const config = loadConfig();
      // Use an invalid path that will fail on write
      config.reportPath = '/invalid/path/that/cannot/be/written/' + Date.now() + '.json';
      const verifier = new OutputVerifier(config);

      // Should not throw
      await verifier.verify({
        id: 'save-err-test',
        timestamp: new Date(),
        description: 'Test',
        output: { ok: true },
      });

      verifier.stop();
    });
  });

  describe('clearHistory error handling', () => {
    it('should handle clearHistory save error gracefully', async () => {
      const config = loadConfig();
      config.reportPath = '/invalid/path/clear-' + Date.now() + '.json';
      const verifier = new OutputVerifier(config);

      // Should not throw
      verifier.clearHistory();

      verifier.stop();
    });
  });

  describe('stop error handling', () => {
    it('should handle stop with invalid path gracefully', async () => {
      const config = loadConfig();
      config.reportPath = '/invalid/stop-' + Date.now() + '.json';
      const verifier = new OutputVerifier(config);

      // Should not throw
      verifier.stop();
    });
  });

  describe('buildReport all status combinations', () => {
    it('should handle partial status correctly', async () => {
      const config = loadConfig();
      config.reportPath = undefined;
      const verifier = new OutputVerifier(config);

      // Create a claim that results in partial status
      const report = await verifier.verify({
        id: 'partial-test',
        timestamp: new Date(),
        description: 'Partial result test',
        toolCalls: [{ tool: 'api_fetch' }], // Missing result -> partial/failed
      });

      expect(report.overallStatus).toBeDefined();
      verifier.stop();
    });

    it('should handle multiple results with different statuses', async () => {
      const config = loadConfig();
      config.reportPath = undefined;
      const verifier = new OutputVerifier(config);

      const report = await verifier.verify({
        id: 'multi-status',
        timestamp: new Date(),
        description: 'Multi status test',
        output: { data: 'test' },
        toolCalls: [{ tool: 'api_fetch', result: { status: 200 } }],
      });

      expect(report.results.length).toBeGreaterThan(0);
      verifier.stop();
    });
  });
});

describe('Additional Coverage - schemaVerifier.ts branches', () => {
  describe('validateAgainstSchema additionalProperties: false', () => {
    it('should detect unexpected properties when additionalProperties is false', async () => {
      const schema = new SchemaVerifier({
        enabled: true,
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          additionalProperties: false,
        },
      });

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        output: { name: 'Alice', age: 30 }, // age is unexpected
      };

      const result = await schema.verify(claim);
      // Score: 100 - 30 = 70, status is 'partial' (70 >= 50)
      expect(result.status).toBe('partial');
      expect(result.details.some((d: any) => d.message.includes('Unexpected'))).toBe(true);
    });

    it('should pass when no unexpected properties', async () => {
      const schema = new SchemaVerifier({
        enabled: true,
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          additionalProperties: false,
        },
      });

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        output: { name: 'Alice' },
      };

      const result = await schema.verify(claim);
      expect(result.status).toBe('passed');
    });
  });

  describe('validateAgainstSchema maxItems', () => {
    it('should fail when array exceeds maxItems', async () => {
      const schema = new SchemaVerifier({
        enabled: true,
        schema: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 2,
        },
      });

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        output: ['a', 'b', 'c', 'd'], // exceeds maxItems: 2
      };

      const result = await schema.verify(claim);
      // Score: 100 - 30 = 70, status is 'partial' (70 >= 50)
      expect(result.status).toBe('partial');
      expect(result.details.some((d: any) => d.message.includes('maximum'))).toBe(true);
    });

    it('should pass when array within maxItems', async () => {
      const schema = new SchemaVerifier({
        enabled: true,
        schema: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 5,
        },
      });

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        output: ['a', 'b'],
      };

      const result = await schema.verify(claim);
      expect(result.status).toBe('passed');
    });
  });

  describe('validateAgainstSchema minItems', () => {
    it('should fail when array has fewer than minItems', async () => {
      const schema = new SchemaVerifier({
        enabled: true,
        schema: {
          type: 'array',
          items: { type: 'string' },
          minItems: 3,
        },
      });

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        output: ['a', 'b'],
      };

      const result = await schema.verify(claim);
      // Score: 100 - 30 = 70, status is 'partial' (70 >= 50)
      expect(result.status).toBe('partial');
      expect(result.details.some((d: any) => d.message.includes('minimum'))).toBe(true);
    });
  });

  describe('validateAgainstSchema pattern validation', () => {
    it('should fail when string does not match pattern', async () => {
      const schema = new SchemaVerifier({
        enabled: true,
        schema: {
          type: 'string',
          pattern: '^[0-9]{3}-[0-9]{3}$', // XXX-XXX format
        },
      });

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        output: 'not-matching-pattern',
      };

      const result = await schema.verify(claim);
      // Score: 100 - 30 = 70, status is 'partial' (70 >= 50)
      expect(result.status).toBe('partial');
      expect(result.details.some((d: any) => d.message.includes('pattern'))).toBe(true);
    });

    it('should pass when string matches pattern', async () => {
      const schema = new SchemaVerifier({
        enabled: true,
        schema: {
          type: 'string',
          pattern: '^[0-9]{3}-[0-9]{3}$',
        },
      });

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        output: '123-456',
      };

      const result = await schema.verify(claim);
      expect(result.status).toBe('passed');
    });
  });

  describe('safeParseJSON error path', () => {
    it('should handle invalid JSON string output', async () => {
      const schema = new SchemaVerifier({
        enabled: true,
        requiredFields: ['field'],
      });

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        output: 'this is not valid json {',
      };

      const result = await schema.verify(claim);
      // Should still process, treating as string and checking placeholders
      expect(result).toBeDefined();
    });
  });

  describe('empty object with additionalProperties', () => {
    it('should check structure for empty object when additionalProperties is true', async () => {
      const schema = new SchemaVerifier({
        enabled: true,
        schema: {
          type: 'object',
          additionalProperties: true,
        },
      });

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        output: {},
      };

      const result = await schema.verify(claim);
      // Empty object with additionalProperties=true should pass structure check
      expect(result.status).toBe('passed');
    });
  });
});

describe('Additional Coverage - e2eVerifier.ts branches', () => {
  describe('registerTestSuite', () => {
    it('should register and run custom test suite', async () => {
      const verifier = new E2eVerifier({ enabled: true });

      verifier.registerTestSuite({
        name: 'custom-suite',
        description: 'Custom test suite',
        tests: [
          {
            name: 'custom-test',
            description: 'A custom test',
            assert: (claim) => ({
              passed: true,
              message: 'Custom test passed',
            }),
          },
        ],
      });

      const suites = verifier.getTestSuites();
      expect(suites.some(s => s.name === 'custom-suite')).toBe(true);

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        output: { ok: true },
      };

      const result = await verifier.verify(claim);
      expect(result.status).toBe('passed');
    });
  });

  describe('skip test handling', () => {
    it('should skip tests marked with skip=true', async () => {
      const verifier = new E2eVerifier({ enabled: true });

      verifier.addTest('skipped-test', {
        description: 'A skipped test',
        skip: true,
        assert: () => ({ passed: false, message: 'Should not run' }),
      });

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        output: { ok: true },
      };

      const result = await verifier.verify(claim);
      // Should still pass because skipped test doesn't count against
      expect(result.status).toBe('passed');
    });
  });

  describe('test assertion error handling', () => {
    it('should handle test that throws error', async () => {
      const verifier = new E2eVerifier({ enabled: true });

      verifier.addTest('error-throwing-test', {
        description: 'Test that throws',
        assert: () => {
          throw new Error('Assertion error');
        },
      });

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        output: { ok: true },
      };

      const result = await verifier.verify(claim);
      // Should handle the error gracefully
      expect(result.details.some((d: any) => d.message.includes('Assertion error'))).toBe(true);
    });
  });

  describe('no applicable tests', () => {
    it('should return passed when all tests are skipped', async () => {
      // Create a custom E2eVerifier with only skipped tests
      const verifier = new E2eVerifier({ enabled: true });

      // Register a test suite with only skipped tests
      verifier.registerTestSuite({
        name: 'empty-suite',
        description: 'Tests that are all skipped',
        tests: [
          {
            name: 'skipped-test',
            description: 'This test is skipped',
            skip: true,
            assert: () => ({ passed: false, message: 'Should not run' }),
          },
        ],
      });

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        output: { ok: true },
      };

      const result = await verifier.verify(claim);
      // When all tests are skipped, passed=0, failed=0, total=0, score=100, status='passed'
      expect(result.status).toBe('passed');
      expect(result.score).toBe(100);
    });
  });

  describe('tool_call_chain_makes_sense validation', () => {
    it('should detect out-of-order timestamps in tool calls', async () => {
      const verifier = new E2eVerifier({ enabled: true });

      const now = Date.now();
      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        output: { ok: true }, // Need output so output_exists passes
        toolCalls: [
          { tool: 'first', timestamp: new Date(now + 1000) },
          { tool: 'second', timestamp: new Date(now) }, // Earlier than first - wrong order
        ],
      };

      const result = await verifier.verify(claim);
      // Should detect the ordering issue
      expect(result.details.some((d: any) => d.message.includes('timestamp'))).toBe(true);
    });

    it('should pass when tool calls have no timestamps', async () => {
      const verifier = new E2eVerifier({ enabled: true });

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        output: { ok: true }, // Need output so output_exists passes
        toolCalls: [
          { tool: 'first' },
          { tool: 'second' },
        ],
      };

      const result = await verifier.verify(claim);
      // Should pass since no timestamps to compare
      expect(result.status).toBe('passed');
    });
  });
});

describe('Additional Coverage - dataVerifier.ts branches', () => {
  describe('validateStructure private method coverage', () => {
    // The validateStructure method is private but indirectly tested through verify
    // This test ensures the error path when data is null is covered

    it('should handle data as null primitive', async () => {
      const verifier = new DataVerifier({ enabled: true });

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        toolCalls: [
          {
            tool: 'data_query',
            result: null, // null result
          },
        ],
      };

      const result = await verifier.verify(claim);
      // Should deduct 30 points for null result
      expect(result.score).toBeLessThan(100);
    });

    it('should handle undefined result', async () => {
      const verifier = new DataVerifier({ enabled: true });

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        toolCalls: [
          {
            tool: 'data_query',
            result: undefined,
          },
        ],
      };

      const result = await verifier.verify(claim);
      expect(result.score).toBeLessThan(100);
    });

    it('should handle result with empty data object', async () => {
      const verifier = new DataVerifier({ enabled: true });

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        toolCalls: [
          {
            tool: 'data_query',
            result: { data: {} }, // empty object
          },
        ],
      };

      const result = await verifier.verify(claim);
      // Should deduct 25 for empty data
      expect(result.score).toBeLessThan(100);
    });

    it('should handle result with empty data array', async () => {
      const verifier = new DataVerifier({ enabled: true });

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        toolCalls: [
          {
            tool: 'data_query',
            result: { data: [] }, // empty array
          },
        ],
      };

      const result = await verifier.verify(claim);
      expect(result.score).toBeLessThan(100);
    });

    it('should handle result with error field', async () => {
      const verifier = new DataVerifier({ enabled: true });

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        toolCalls: [
          {
            tool: 'data_query',
            result: { error: 'Database connection failed' },
          },
        ],
      };

      const result = await verifier.verify(claim);
      expect(result.score).toBeLessThan(100);
      expect(result.details.some((d: any) => d.message.includes('Database connection failed'))).toBe(true);
    });

    it('should handle result with err field', async () => {
      const verifier = new DataVerifier({ enabled: true });

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        toolCalls: [
          {
            tool: 'data_query',
            result: { err: 'Query timeout' },
          },
        ],
      };

      const result = await verifier.verify(claim);
      expect(result.score).toBeLessThan(100);
    });

    it('should handle result with failed field', async () => {
      const verifier = new DataVerifier({ enabled: true });

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        toolCalls: [
          {
            tool: 'data_query',
            result: { failed: true },
          },
        ],
      };

      const result = await verifier.verify(claim);
      expect(result.score).toBeLessThan(100);
    });
  });

  describe('data extraction paths', () => {
    it('should extract data from result.data field', async () => {
      const verifier = new DataVerifier({ enabled: true });

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        toolCalls: [
          {
            tool: 'data_query',
            result: { data: { rows: [1, 2, 3] } },
          },
        ],
      };

      const result = await verifier.verify(claim);
      expect(result.status).toBe('passed');
    });

    it('should extract data from result.result field', async () => {
      const verifier = new DataVerifier({ enabled: true });

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        toolCalls: [
          {
            tool: 'data_query',
            result: { result: { items: ['a', 'b'] } },
          },
        ],
      };

      const result = await verifier.verify(claim);
      expect(result.status).toBe('passed');
    });

    it('should extract data from result.rows field', async () => {
      const verifier = new DataVerifier({ enabled: true });

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        toolCalls: [
          {
            tool: 'data_query',
            result: { rows: [{ id: 1 }] },
          },
        ],
      };

      const result = await verifier.verify(claim);
      expect(result.status).toBe('passed');
    });

    it('should treat result as data when no subfield exists', async () => {
      const verifier = new DataVerifier({ enabled: true });

      const claim: AgentClaim = {
        id: 'test',
        timestamp: new Date(),
        description: 'Test',
        toolCalls: [
          {
            tool: 'data_query',
            result: { items: 'primitive-value' },
          },
        ],
      };

      const result = await verifier.verify(claim);
      expect(result.status).toBe('passed');
    });
  });
});

describe('Additional Coverage - buildReport status logic', () => {
  it('should calculate score correctly with multiple results', async () => {
    const config = loadConfig();
    config.reportPath = undefined;
    const verifier = new OutputVerifier(config);

    const report = await verifier.verify({
      id: 'score-calc',
      timestamp: new Date(),
      description: 'Score calc test',
      output: { ok: true },
    });

    // Score should be average of all result scores
    const avgScore = report.results.reduce((sum, r) => sum + r.score, 0) / report.results.length;
    expect(report.overallScore).toBeCloseTo(avgScore, 0);

    verifier.stop();
  });
});
