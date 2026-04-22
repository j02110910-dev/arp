/**
 * Data Verifier Tests
 */

import { DataVerifier } from '../src/verifiers/dataVerifier';
import { AgentClaim } from '../src/types';

function createClaim(toolCalls: AgentClaim['toolCalls']): AgentClaim {
  return {
    id: 'test-claim',
    timestamp: new Date(),
    description: 'Test data operation',
    toolCalls,
  };
}

describe('DataVerifier', () => {
  let verifier: DataVerifier;

  beforeEach(() => {
    verifier = new DataVerifier({ enabled: true });
  });

  describe('canVerify', () => {
    it('should verify claims with data-related tool calls', () => {
      expect(verifier.canVerify(createClaim([{ tool: 'query_data', result: {} }]))).toBe(true);
      expect(verifier.canVerify(createClaim([{ tool: 'database_query', result: {} }]))).toBe(true);
      expect(verifier.canVerify(createClaim([{ tool: 'sql_select', result: {} }]))).toBe(true);
      expect(verifier.canVerify(createClaim([{ tool: 'insert_record', result: {} }]))).toBe(true);
      expect(verifier.canVerify(createClaim([{ tool: 'update_row', result: {} }]))).toBe(true);
      expect(verifier.canVerify(createClaim([{ tool: 'delete_entry', result: {} }]))).toBe(true);
    });

    it('should verify claims with data args', () => {
      expect(verifier.canVerify(createClaim([{ tool: 'custom_tool', args: { data: {} }, result: {} }]))).toBe(true);
    });

    it('should verify claims with result args', () => {
      expect(verifier.canVerify(createClaim([{ tool: 'custom_tool', args: { result: {} }, result: {} }]))).toBe(true);
    });

    it('should not verify claims without tool calls', () => {
      expect(verifier.canVerify(createClaim(undefined as any))).toBe(false);
    });

    it('should not verify claims with empty tool calls', () => {
      expect(verifier.canVerify(createClaim([]))).toBe(false);
    });

    it('should not verify non-data tool calls', () => {
      expect(verifier.canVerify(createClaim([{ tool: 'search', result: {} }]))).toBe(false);
      expect(verifier.canVerify(createClaim([{ tool: 'compute', result: {} }]))).toBe(false);
    });
  });

  describe('verify - result checks', () => {
    it('should skip when no data operations found', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'search', result: { data: [] } },
      ]));
      expect(result.status).toBe('skipped');
      expect(result.message).toContain('No data operations found');
    });

    it('should deduct 30 points when result is undefined', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'query_data', result: undefined },
      ]));
      expect(result.score).toBe(70);
      expect(result.details.some(d => d.message.includes('returned no result'))).toBe(true);
    });

    it('should deduct 30 points when result is null', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'query_data', result: null },
      ]));
      expect(result.score).toBe(70);
    });

    it('should deduct 25 points when data is empty object', async () => {
      // resultObj.data = {} -> fallback chain returns {} which is an object with 0 keys
      const result = await verifier.verify(createClaim([
        { tool: 'query_data', result: { data: {} } },
      ]));
      expect(result.score).toBe(75); // 100 - 25
      expect(result.details.some(d => d.message.includes('empty data'))).toBe(true);
    });

    it('should deduct 25 points when data is empty array', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'query_data', result: { data: [] } },
      ]));
      expect(result.score).toBe(75);
    });

    it('should NOT deduct for data:null inside result object (falls back to result itself which has keys)', async () => {
      // resultObj.data = null, but || chain falls back to resultObj which has 'data' key
      // Since resultObj is {data:null} with keys, hasData = true
      const result = await verifier.verify(createClaim([
        { tool: 'query_data', result: { data: null } },
      ]));
      expect(result.score).toBe(100); // No deduction because resultObj has keys
    });

    it('should deduct 25 points for error in result', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'query_data', result: { error: 'Connection failed' } },
      ]));
      expect(result.score).toBe(75); // 100 - 25
      expect(result.details.some(d => d.message.includes('returned an error'))).toBe(true);
    });

    it('should deduct 25 points for err in result', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'query_data', result: { err: 'Error occurred' } },
      ]));
      expect(result.score).toBe(75);
    });

    it('should deduct 25 points for failed in result', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'query_data', result: { failed: 'Operation failed' } },
      ]));
      expect(result.score).toBe(75);
    });

    it('should combine multiple deductions within same verify call', async () => {
      // Both checks happen within same loop, so deductions are cumulative
      // Call 1: result=undefined -> -30 -> 70
      // Call 2: data=[] -> -25 -> 70-25=45
      const result = await verifier.verify(createClaim([
        { tool: 'query_data', result: undefined },
        { tool: 'sql_select', result: { data: [] } },
      ]));
      expect(result.score).toBe(45);
      expect(result.status).toBe('failed');
    });
  });

  describe('verify - status scoring', () => {
    it('should return passed status for score >= 80', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'query_data', result: { data: { users: [{ id: 1 }] } } },
      ]));
      expect(result.status).toBe('passed');
      expect(result.score).toBe(100);
    });

    it('should return partial status for score 50-79', async () => {
      // First: data=[] -> hasData=false -> -25
      // Second: data={rows:[]} -> data={rows:[]} is object with 1 key -> hasData=true -> 0
      // But we also check the second's data field specifically:
      // Actually verify the code's actual scoring
      const r1 = await verifier.verify(createClaim([
        { tool: 'query_data', result: { data: [] } },  // -25
      ]));
      // Second call with empty data object  
      const r2 = await verifier.verify(createClaim([
        { tool: 'sql_select', result: { data: {} } },  // -25 (empty object)
      ]));
      expect(r1.score).toBe(75);
      expect(r2.score).toBe(75);
      expect(r1.status).toBe('partial');
    });

    it('should return failed status for score < 50', async () => {
      // Multiple issues add up
      const result = await verifier.verify(createClaim([
        { tool: 'query_data', result: null },  // -30
        { tool: 'sql_select', result: { data: [] } },  // -25
        { tool: 'insert', result: { error: 'failed' } },  // -25
      ]));
      expect(result.score).toBe(20);
      expect(result.status).toBe('failed');
    });

    it('should not go below 0', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'query_data', result: null },
        { tool: 'sql_select', result: { data: null } },
        { tool: 'insert', result: { error: 'err' } },
        { tool: 'delete', result: { failed: true } },
        { tool: 'update', result: undefined },
      ]));
      expect(result.score).toBe(0);
    });
  });

  describe('verify - data extraction from result', () => {
    it('should extract data from result.data field', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'query_data', result: { data: { items: [1, 2] } } },
      ]));
      expect(result.status).toBe('passed');
    });

    it('should extract data from result.result field', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'query_data', result: { result: { items: [1, 2] } } },
      ]));
      expect(result.status).toBe('passed');
    });

    it('should extract data from result.rows field', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'query_data', result: { rows: [{ id: 1 }] } },
      ]));
      expect(result.status).toBe('passed');
    });

    it('should treat result as data when no subfield exists', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'query_data', result: 'some string data' },
      ]));
      // String is valid non-null data
      expect(result.status).toBe('passed');
    });
  });

  describe('buildResult', () => {
    it('should include suggestedFix for failed status', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'query_data', result: null },
        { tool: 'sql_select', result: null },
      ]));
      expect(result.suggestedFix).toBeDefined();
      expect(typeof result.suggestedFix).toBe('string');
    });

    it('should not include suggestedFix for passed status', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'query_data', result: { data: { ok: true } } },
      ]));
      expect(result.suggestedFix).toBeUndefined();
    });

    it('should have correct verifierType', async () => {
      const result = await verifier.verify(createClaim([
        { tool: 'query_data', result: { data: {} } },
      ]));
      expect(result.verifierType).toBe('data');
    });
  });
});
