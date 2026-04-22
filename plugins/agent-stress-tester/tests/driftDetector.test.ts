import { DriftDetector, cosineSimilarity } from '../src/analyzers/driftDetector';
import { TestResult } from '../src/types';

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
  });
  it('should return 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });
  it('should return 0 for empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });
});

describe('DriftDetector', () => {
  const detector = new DriftDetector(0.85);

  it('should not detect drift for similar responses', () => {
    detector.setBaseline('test1', 'The quick brown fox');
    const result = { testCaseId: 'test1', passed: true, latency: 100, response: 'The quick brown fox jumps', timestamp: Date.now() } as TestResult;
    const metrics = detector.detectFromResult(result, 'The quick brown fox');
    expect(metrics.driftDetected).toBe(false);
    expect(metrics.similarity).toBeGreaterThan(0.8);
  });

  it('should set threshold and use it for drift detection', () => {
    // Test drift detection flag is set based on threshold
    detector.setThreshold(0.99);
    detector.setBaseline('test3', 'hello world');
    const result = { testCaseId: 'test3', passed: true, latency: 100, response: 'different text', timestamp: Date.now() } as TestResult;
    const metrics = detector.detectFromResult(result, 'hello world');
    expect(metrics.threshold).toBe(0.99);
    // Drift is detected because similarity will be 0 (no common terms) and 0 < 0.99
    expect(metrics.driftDetected).toBe(true);
  });

  it('should allow threshold to be set', () => {
    detector.setThreshold(0.95);
    expect(() => detector.setThreshold(0.5)).not.toThrow();
  });
});
