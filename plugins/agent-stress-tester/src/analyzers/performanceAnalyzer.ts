import { PerformanceMetrics, TestResult } from '../types';

export function calculateQPS(totalRequests: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return (totalRequests / durationMs) * 1000;
}

export function calculateLatencyPercentiles(latencies: number[]): {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
} {
  if (latencies.length === 0) {
    return { p50: 0, p90: 0, p95: 0, p99: 0 };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const get = (pct: number) => sorted[Math.floor(sorted.length * pct) - 1] || 0;
  return {
    p50: get(0.5),
    p90: get(0.9),
    p95: get(0.95),
    p99: get(0.99),
  };
}

export class PerformanceAnalyzer {
  private results: TestResult[] = [];
  private latencies: number[] = [];

  addResult(result: TestResult): void {
    this.results.push(result);
    this.latencies.push(result.latency);
  }

  analyze(): PerformanceMetrics {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const total = sorted.length;
    const get = (p: number) => sorted[Math.floor(total * p) - 1] || 0;

    const duration = this.results.length > 0
      ? (this.results[this.results.length - 1].timestamp - this.results[0].timestamp)
      : 1;

    return {
      totalRequests: total,
      successfulRequests: this.results.filter((r) => r.passed).length,
      failedRequests: this.results.filter((r) => !r.passed).length,
      qps: calculateQPS(total, duration),
      avgLatency: total > 0 ? sorted.reduce((a, b) => a + b, 0) / total : 0,
      p50: get(0.5),
      p90: get(0.9),
      p95: get(0.95),
      p99: get(0.99),
    };
  }

  getReport(): string {
    const m = this.analyze();
    return [
      `Performance Report`,
      `  Total Requests: ${m.totalRequests}`,
      `  Successful: ${m.successfulRequests} | Failed: ${m.failedRequests}`,
      `  QPS: ${m.qps.toFixed(2)}`,
      `  Latency - Avg: ${m.avgLatency.toFixed(0)}ms, P50: ${m.p50}ms, P90: ${m.p90}ms, P95: ${m.p95}ms, P99: ${m.p99}ms`,
    ].join('\n');
  }
}
