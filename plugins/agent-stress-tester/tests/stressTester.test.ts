import { StressTester } from '../src/StressTester';
import { TestCase, TestResult } from '../src/types';

describe('StressTester', () => {
  it('should create with default config', () => {
    const tester = new StressTester();
    expect(tester.getConfig().enabled).toBe(false);
    expect(tester.getConfig().maxConcurrent).toBeGreaterThan(0);
  });

  it('should register analyzers', () => {
    const tester = new StressTester();
    const cb = jest.fn();
    tester.registerAnalyzer(cb);
    expect(() => tester.registerAnalyzer(jest.fn())).not.toThrow();
  });

  it('should run a single test case', async () => {
    const tester = new StressTester();
    const tc: TestCase = {
      id: 'test-1',
      name: 'Test 1',
      type: 'normal',
      prompt: 'Hello',
    };
    const result = await tester.runTestCase(tc);
    expect(result.testCaseId).toBe('test-1');
    expect(result.latency).toBeGreaterThanOrEqual(0);
  });

  it('should run stress test with multiple cases', async () => {
    const tester = new StressTester({ enabled: true, targetAgent: 'test', testTimeout: 5000, maxConcurrent: 3, testSuites: ['normal'], driftThreshold: 0.85, loadProfiles: [] });
    const cases: TestCase[] = [
      { id: 's1', name: 'Test 1', type: 'normal', prompt: 'Hello' },
      { id: 's2', name: 'Test 2', type: 'normal', prompt: 'World' },
    ];
    const report = await tester.runStressTest(cases);
    expect(report.summary.total).toBe(2);
    expect(report.results.length).toBe(2);
  });

  it('should emit events', async () => {
    const tester = new StressTester();
    const startFn = jest.fn();
    const endFn = jest.fn();
    tester.on('test:start', startFn);
    tester.on('test:end', endFn);
    await tester.runTestCase({ id: 'e1', name: 'Event test', type: 'normal', prompt: 'ping' });
    expect(startFn).toHaveBeenCalled();
    expect(endFn).toHaveBeenCalled();
  });
});
