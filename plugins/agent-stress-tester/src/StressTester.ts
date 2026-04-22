import { StressTestConfig, TestCase, TestResult, StressTestReport, PerformanceMetrics } from './types';
import { loadConfig } from './config';

export type AnalyzerCallback = (result: TestResult) => void;
export type DetectorCallback = (result: TestResult) => void;

export class StressTester {
  private config: StressTestConfig;
  private analyzers: AnalyzerCallback[] = [];
  private detectors: DetectorCallback[] = [];
  private eventListeners: Map<string, Function[]> = new Map();
  private results: TestResult[] = [];
  private latencies: number[] = [];

  constructor(config?: StressTestConfig) {
    this.config = config || loadConfig();
  }

  registerAnalyzer(cb: AnalyzerCallback): void {
    this.analyzers.push(cb);
  }

  registerDetector(cb: DetectorCallback): void {
    this.detectors.push(cb);
  }

  on(event: string, cb: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(cb);
  }

  off(event: string, cb: Function): void {
    const cbs = this.eventListeners.get(event) || [];
    const idx = cbs.indexOf(cb);
    if (idx >= 0) cbs.splice(idx, 1);
  }

  private emit(event: string, data: unknown): void {
    const cbs = this.eventListeners.get(event) || [];
    cbs.forEach((cb) => cb(data));
  }

  async runTestCase(testCase: TestCase): Promise<TestResult> {
    const start = Date.now();
    try {
      this.emit('test:start', testCase);
      const result = await this.callAgent(testCase);
      const latency = Date.now() - start;
      const testResult: TestResult = {
        testCaseId: testCase.id,
        passed: this.evaluateResult(result, testCase),
        latency,
        response: result,
        timestamp: Date.now(),
      };
      this.results.push(testResult);
      this.latencies.push(latency);
      this.analyzers.forEach((a) => a(testResult));
      this.detectors.forEach((d) => d(testResult));
      this.emit('test:end', testResult);
      return testResult;
    } catch (err) {
      const latency = Date.now() - start;
      const errorResult: TestResult = {
        testCaseId: testCase.id,
        passed: false,
        latency,
        error: err instanceof Error ? err.message : String(err),
        timestamp: Date.now(),
      };
      this.results.push(errorResult);
      this.latencies.push(latency);
      this.emit('test:end', errorResult);
      return errorResult;
    }
  }

  protected async callAgent(testCase: TestCase): Promise<string> {
    // Override this in subclass to connect to actual agent
    return `Mock response for: ${testCase.prompt.substring(0, 50)}...`;
  }

  private evaluateResult(response: string, testCase: TestCase): boolean {
    if (!testCase.expectedBehavior) return true;
    return response.toLowerCase().includes(testCase.expectedBehavior.toLowerCase());
  }

  async runStressTest(testCases: TestCase[]): Promise<StressTestReport> {
    const startTime = Date.now();
    this.results = [];
    this.latencies = [];
    this.emit('stress:test:start', { total: testCases.length });

    const promises: Promise<TestResult>[] = [];
    let running = 0;

    for (const tc of testCases) {
      while (running >= this.config.maxConcurrent) {
        await Promise.race(promises);
      }
      const p = this.runTestCase(tc);
      promises.push(p);
      running++;
      p.finally(() => {
        running--;
        const idx = promises.indexOf(p);
        if (idx >= 0) promises.splice(idx, 1);
      });
    }

    await Promise.all(promises);
    const endTime = Date.now();

    const driftResults = this.results
      .filter((r) => r.driftScore !== undefined)
      .map((r) => ({
        testCaseId: r.testCaseId,
        baseline: '',
        current: r.response || '',
        similarity: 1 - (r.driftScore || 0),
        driftDetected: (r.driftScore || 0) > (1 - this.config.driftThreshold),
        threshold: this.config.driftThreshold,
      }));

    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;

    const report: StressTestReport = {
      config: this.config,
      startTime,
      endTime,
      results: this.results,
      driftMetrics: driftResults,
      performance: this.computePerformanceMetrics(startTime, endTime),
      summary: {
        total: this.results.length,
        passed,
        failed,
        driftDetected: driftResults.filter((d) => d.driftDetected).length,
      },
    };

    this.emit('stress:test:end', report);
    return report;
  }

  private computePerformanceMetrics(start: number, end: number): PerformanceMetrics {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const total = sorted.length;
    const p = (pct: number) => sorted[Math.floor(total * pct) - 1] || 0;

    return {
      totalRequests: total,
      successfulRequests: this.results.filter((r) => r.passed).length,
      failedRequests: this.results.filter((r) => !r.passed).length,
      qps: (total / (end - start)) * 1000,
      avgLatency: sorted.reduce((a, b) => a + b, 0) / total,
      p50: p(0.5),
      p90: p(0.9),
      p95: p(0.95),
      p99: p(0.99),
    };
  }

  getResults(): TestResult[] {
    return [...this.results];
  }

  getConfig(): StressTestConfig {
    return { ...this.config };
  }
}
