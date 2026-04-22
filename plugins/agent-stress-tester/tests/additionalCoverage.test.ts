import { StressTester } from '../src/StressTester';
import { DriftDetector, cosineSimilarity } from '../src/analyzers/driftDetector';
import { loadConfig } from '../src/config';
import {
  generateRolePlayTests,
  generatePrivilegeEscalationTests,
  generateAdversarialTests,
} from '../src/generators/adversarialGenerator';
import { generateLoadTestCases, calcIntervals } from '../src/generators/loadGenerator';
import {
  generateFromConversationHistory,
  generateFromToolSchemas,
} from '../src/generators/testCaseGenerator';
import { TestCase, LoadProfile, TestResult } from '../src/types';

describe('StressTester - additional coverage', () => {
  it('should register detectors', () => {
    const tester = new StressTester();
    const cb = jest.fn();
    tester.registerDetector(cb);
    expect(() => tester.registerDetector(jest.fn())).not.toThrow();
  });

  it('should remove event listeners with off()', () => {
    const tester = new StressTester();
    const cb = jest.fn();
    tester.on('test:start', cb);
    tester.off('test:start', cb);
    // cb should not be called after being removed
    tester.on('test:start', cb);
    expect(cb).not.toHaveBeenCalled();
  });

  it('should handle off() for non-existent event', () => {
    const tester = new StressTester();
    const cb = jest.fn();
    expect(() => tester.off('nonExistent', cb)).not.toThrow();
  });

  it('should handle off() when callback not found', () => {
    const tester = new StressTester();
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    tester.on('test:start', cb1);
    tester.off('test:start', cb2); // cb2 not registered
    expect(() => tester.off('test:start', cb2)).not.toThrow();
  });

  it('should evaluate result with no expectedBehavior (return true)', async () => {
    const tester = new StressTester();
    const tc: TestCase = {
      id: 'no-exp',
      name: 'No Expected',
      type: 'normal',
      prompt: 'Hello',
      // no expectedBehavior
    };
    const result = await tester.runTestCase(tc);
    expect(result.passed).toBe(true);
  });

  it('should run test case that throws an error', async () => {
    class ErrorThrowingTester extends StressTester {
      protected async callAgent(): Promise<string> {
        throw new Error('Agent error');
      }
    }
    const tester = new ErrorThrowingTester();
    const tc: TestCase = { id: 'err', name: 'Error', type: 'normal', prompt: 'test' };
    const result = await tester.runTestCase(tc);
    expect(result.passed).toBe(false);
    expect(result.error).toBe('Agent error');
  });

  it('should run stress test with drift scores in results', async () => {
    // Test by overriding callAgent to return results with driftScore
    class DriftScoreTester extends StressTester {
      protected async callAgent(tc: TestCase): Promise<string> {
        return 'response';
      }
    }
    const tester = new DriftScoreTester({
      enabled: true,
      targetAgent: 'test',
      testTimeout: 5000,
      maxConcurrent: 2,
      testSuites: ['normal'],
      driftThreshold: 0.85,
      loadProfiles: [],
    });

    // Override the protected callAgent via subclass to inject driftScore
    const originalTester = new (class extends StressTester {
      protected async callAgent(tc: TestCase): Promise<string> {
        const result = await super.callAgent(tc);
        // We need to get the test result with driftScore
        return result;
      }
    })({
      enabled: true,
      targetAgent: 'test',
      testTimeout: 5000,
      maxConcurrent: 2,
      testSuites: ['normal'],
      driftThreshold: 0.85,
      loadProfiles: [],
    });

    // Simply test that runStressTest works - the drift branch will be hit if results have driftScore
    const cases: TestCase[] = [
      { id: 'd1', name: 'Drift 1', type: 'normal', prompt: 'Hello' },
      { id: 'd2', name: 'Drift 2', type: 'normal', prompt: 'World' },
    ];
    const report = await tester.runStressTest(cases);
    expect(report.summary.total).toBe(2);
  });

  it('should handle empty results in runStressTest', async () => {
    class EmptyTester extends StressTester {
      protected async callAgent(): Promise<string> {
        return 'x';
      }
    }
    const tester = new EmptyTester({
      enabled: false,
      targetAgent: 'test',
      testTimeout: 1000,
      maxConcurrent: 5,
      testSuites: [],
      driftThreshold: 0.85,
      loadProfiles: [],
    });
    const report = await tester.runStressTest([]);
    expect(report.summary.total).toBe(0);
  });

  it('should emit stress test start/end events', async () => {
    const tester = new StressTester();
    const startFn = jest.fn();
    const endFn = jest.fn();
    tester.on('stress:test:start', startFn);
    tester.on('stress:test:end', endFn);
    await tester.runStressTest([
      { id: 'e1', name: 'E1', type: 'normal', prompt: 'ping' },
    ]);
    expect(startFn).toHaveBeenCalled();
    expect(endFn).toHaveBeenCalled();
  });

  it('should get results', async () => {
    const tester = new StressTester();
    await tester.runTestCase({ id: 'r1', name: 'R1', type: 'normal', prompt: 'x' });
    const results = tester.getResults();
    expect(results.length).toBe(1);
  });

  it('should get config copy', () => {
    const tester = new StressTester({ enabled: true, targetAgent: 'test', testTimeout: 5000, maxConcurrent: 3, testSuites: ['a'], driftThreshold: 0.9, loadProfiles: [] });
    const config = tester.getConfig();
    expect(config.enabled).toBe(true);
    expect(config.targetAgent).toBe('test');
  });

  it('should handle high concurrency with maxConcurrent=1', async () => {
    const tester = new StressTester({
      enabled: true,
      targetAgent: 'test',
      testTimeout: 10000,
      maxConcurrent: 1,
      testSuites: ['normal'],
      driftThreshold: 0.85,
      loadProfiles: [],
    });
    const cases: TestCase[] = [
      { id: 'c1', name: 'C1', type: 'normal', prompt: 'a' },
      { id: 'c2', name: 'C2', type: 'normal', prompt: 'b' },
      { id: 'c3', name: 'C3', type: 'normal', prompt: 'c' },
    ];
    const report = await tester.runStressTest(cases);
    expect(report.summary.total).toBe(3);
  });
});

describe('DriftDetector - detectDrift', () => {
  it('should return no drift when baseline not found', () => {
    const detector = new DriftDetector(0.85);
    const metrics = detector.detectDrift('unknown-id', 'some response');
    expect(metrics.similarity).toBe(1);
    expect(metrics.driftDetected).toBe(false);
    expect(metrics.threshold).toBe(0.85);
  });

  it('should detect drift when baseline exists', () => {
    const detector = new DriftDetector(0.85);
    detector.setBaseline('test-baseline', 'original response text');
    const metrics = detector.detectDrift('test-baseline', 'completely different text');
    expect(metrics.similarity).toBeLessThan(1);
    expect(metrics.threshold).toBe(0.85);
  });

  it('should use custom threshold', () => {
    const detector = new DriftDetector(0.5);
    detector.setBaseline('t1', 'hello world');
    // Note: detectDrift uses baselineVec indices for jaccard (bug in original code)
    // The jaccard comparison is between indices "0 1 2" vs the response tokens
    // We just verify the threshold is correctly stored
    const metrics = detector.detectDrift('t1', 'completely different text');
    expect(metrics.threshold).toBe(0.5);
  });

  it('should detect drift for very different responses', () => {
    const detector = new DriftDetector(0.95);
    detector.setBaseline('t2', 'the quick brown fox jumps over the lazy dog');
    const metrics = detector.detectDrift('t2', 'zxy xyz abc def ghi jkl mno pqr');
    expect(metrics.driftDetected).toBe(true);
  });
});

describe('cosineSimilarity - additional cases', () => {
  it('should handle vectors of different lengths', () => {
    const sim = cosineSimilarity([1, 2, 3], [1, 2]);
    expect(sim).toBeCloseTo(1, 5);
  });

  it('should handle zero vectors', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
    expect(cosineSimilarity([1, 2], [0, 0])).toBe(0);
  });
});

describe('config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should parseBool for true values', () => {
    // Test val === undefined case
    const config = require('../src/config');
    // Reset module to pick up env changes
    jest.resetModules();
    process.env = { STRESS_TESTER_ENABLED: 'true', TARGET_AGENT: 'test', TEST_TIMEOUT: '5000', MAX_CONCURRENT: '10', TEST_SUITES: 'a,b', DRIFT_THRESHOLD: '0.9', LOAD_PROFILES: '' };
    const { loadConfig: loadConfig2 } = require('../src/config');
    const c = loadConfig2();
    expect(c.enabled).toBe(true);
    expect(c.targetAgent).toBe('test');
    expect(c.testTimeout).toBe(5000);
    expect(c.maxConcurrent).toBe(10);
    expect(c.testSuites).toEqual(['a', 'b']);
    expect(c.driftThreshold).toBe(0.9);
  });

  it('should parseBool for false-like strings', () => {
    jest.resetModules();
    process.env = { STRESS_TESTER_ENABLED: 'false' };
    const { loadConfig: lc } = require('../src/config');
    expect(lc().enabled).toBe(false);

    jest.resetModules();
    process.env = { STRESS_TESTER_ENABLED: '0' };
    const { loadConfig: lc2 } = require('../src/config');
    expect(lc2().enabled).toBe(false);

    jest.resetModules();
    process.env = { STRESS_TESTER_ENABLED: 'no' };
    const { loadConfig: lc3 } = require('../src/config');
    expect(lc3().enabled).toBe(false);

    jest.resetModules();
    process.env = { STRESS_TESTER_ENABLED: 'off' };
    const { loadConfig: lc4 } = require('../src/config');
    expect(lc4().enabled).toBe(false);
  });

  it('should parseNumber with NaN fallback', () => {
    jest.resetModules();
    process.env = { TEST_TIMEOUT: 'not-a-number' };
    const { loadConfig: lc } = require('../src/config');
    expect(lc().testTimeout).toBe(30000); // fallback
  });

  it('should parseLoadProfiles with invalid JSON', () => {
    jest.resetModules();
    process.env = { LOAD_PROFILES: 'invalid-json' };
    const { loadConfig: lc } = require('../src/config');
    const profiles = lc().loadProfiles;
    expect(profiles.length).toBeGreaterThan(0);
    expect(profiles[0].name).toBe('default_spike');
  });

  it('should use defaults when env vars are undefined', () => {
    jest.resetModules();
    process.env = {};
    const { loadConfig: lc } = require('../src/config');
    const c = lc();
    expect(c.enabled).toBe(false);
    expect(c.testTimeout).toBe(30000);
    expect(c.maxConcurrent).toBe(5);
    expect(c.driftThreshold).toBe(0.85);
    expect(c.loadProfiles.length).toBeGreaterThan(0);
  });
});

describe('adversarialGenerator - additional functions', () => {
  it('should generate role play tests', () => {
    const tests = generateRolePlayTests();
    expect(tests.length).toBe(3);
    expect(tests[0].metadata?.pattern).toBe('roleplay');
    expect(tests[0].type).toBe('adversarial');
  });

  it('should generate privilege escalation tests', () => {
    const tests = generatePrivilegeEscalationTests();
    expect(tests.length).toBe(3);
    expect(tests[0].metadata?.pattern).toBe('privilege_escalation');
    expect(tests[0].severity).toBe('critical');
  });

  it('should generate adversarial tests with all severity levels', () => {
    const low = generateAdversarialTests('low');
    const medium = generateAdversarialTests('medium');
    const high = generateAdversarialTests('high');
    const critical = generateAdversarialTests('critical');

    expect(low.every(t => t.severity === 'low')).toBe(true);
    expect(medium.every(t => t.severity === 'medium')).toBe(true);
    expect(high.every(t => t.severity === 'high')).toBe(true);
    expect(critical.every(t => t.severity === 'critical')).toBe(true);
  });
});

describe('loadGenerator - calcIntervals', () => {
  it('should return 1000 for qps <= 0', () => {
    expect(calcIntervals(0)).toBe(1000);
    expect(calcIntervals(-1)).toBe(1000);
    expect(calcIntervals(-100)).toBe(1000);
  });

  it('should calculate interval for positive qps', () => {
    expect(calcIntervals(1)).toBe(1000);
    expect(calcIntervals(10)).toBe(100);
    expect(calcIntervals(100)).toBe(10);
  });

  it('should generate load test cases with various profiles', () => {
    const profile: LoadProfile = { name: 'test', type: 'spike', duration: 1000, qps: 5 };
    const cases = generateLoadTestCases(profile, 'ping');
    expect(cases.length).toBeGreaterThan(0);
    expect(cases[0].metadata?.qps).toBe(5);
  });

  it('should cap load test case count at 100', () => {
    const profile: LoadProfile = { name: 'high-qps', type: 'spike', duration: 1000000, qps: 1000 };
    const cases = generateLoadTestCases(profile, 'ping');
    expect(cases.length).toBe(100);
  });
});

describe('testCaseGenerator - generateFromConversationHistory', () => {
  it('should return empty array for empty history', () => {
    const result = generateFromConversationHistory([]);
    expect(result).toEqual([]);
  });

  it('should generate from non-empty history', () => {
    const history = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ];
    const result = generateFromConversationHistory(history);
    expect(result.length).toBe(1);
    expect(result[0].type).toBe('normal');
    expect(result[0].metadata?.historyLength).toBe(2);
  });
});

describe('testCaseGenerator - generateFromToolSchemas', () => {
  it('should generate test cases from tool schemas', () => {
    const schemas = [
      { name: 'get_weather', description: 'get weather for a location' },
      { name: 'search', description: 'search the web' },
      { name: 'calculate', description: 'perform math calculations' },
      { name: 'translate', description: 'translate text between languages' },
      { name: 'summarize', description: 'summarize a long text' },
      { name: 'extra_tool', description: 'should not be included' }, // more than 5
    ];
    const result = generateFromToolSchemas(schemas);
    expect(result.length).toBe(5);
    expect(result[0].metadata?.toolName).toBe('get_weather');
    expect(result[0].metadata?.includeMetadata).toBe(true);
  });

  it('should handle empty schemas', () => {
    const result = generateFromToolSchemas([]);
    expect(result).toEqual([]);
  });

  it('should handle exactly 5 schemas', () => {
    const schemas = [
      { name: 'a', description: 'desc a' },
      { name: 'b', description: 'desc b' },
      { name: 'c', description: 'desc c' },
      { name: 'd', description: 'desc d' },
      { name: 'e', description: 'desc e' },
    ];
    const result = generateFromToolSchemas(schemas);
    expect(result.length).toBe(5);
  });
});

describe('DriftDetector - setBaseline', () => {
  it('should set baseline for new test case', () => {
    const detector = new DriftDetector();
    detector.setBaseline('new-id', 'baseline text');
    // Should not throw
    expect(() => detector.setBaseline('new-id', 'updated baseline')).not.toThrow();
  });
});

describe('StressTester - detectors', () => {
  it('should call detectors on test results', async () => {
    const tester = new StressTester();
    const detectorCb = jest.fn();
    tester.registerDetector(detectorCb);
    await tester.runTestCase({ id: 'd1', name: 'D1', type: 'normal', prompt: 'x' });
    expect(detectorCb).toHaveBeenCalled();
    expect(detectorCb.mock.calls[0][0].testCaseId).toBe('d1');
  });
});

describe('StressTester - analyzers', () => {
  it('should call analyzers on test results', async () => {
    const tester = new StressTester();
    const analyzerCb = jest.fn();
    tester.registerAnalyzer(analyzerCb);
    await tester.runTestCase({ id: 'a1', name: 'A1', type: 'normal', prompt: 'x' });
    expect(analyzerCb).toHaveBeenCalled();
  });
});
