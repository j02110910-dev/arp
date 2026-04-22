import { DriftMetrics, TestResult } from '../types';

function tokenize(text: string): Map<string, number> {
  const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
  const freq = new Map<string, number>();
  for (const t of tokens) {
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  return freq;
}

function textToVector(text: string): number[] {
  const freq = tokenize(text);
  const maxFreq = Math.max(...Array.from(freq.values()), 1);
  const terms = Array.from(freq.keys()).sort();
  return terms.map((t) => freq.get(t)! / maxFreq);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const len = Math.min(a.length, b.length);
  const aSlice = a.slice(0, len);
  const bSlice = b.slice(0, len);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += aSlice[i] * bSlice[i];
    normA += aSlice[i] * aSlice[i];
    normB += bSlice[i] * bSlice[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function jaccardTokens(textA: string, textB: string): number {
  const tokensA = Array.from(new Set(textA.toLowerCase().split(/\s+/).filter(Boolean)));
  const tokensB = Array.from(new Set(textB.toLowerCase().split(/\s+/).filter(Boolean)));
  if (tokensA.length === 0 && tokensB.length === 0) return 1;
  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.includes(t)) intersection++;
  }
  const union = tokensA.length + tokensB.length - intersection;
  return union === 0 ? 0 : intersection / union;
}

export class DriftDetector {
  private threshold: number;
  private baselineVectors: Map<string, number[]> = new Map();
  private history: Map<string, string[]> = new Map();
  private maxHistory = 10;

  constructor(threshold = 0.85) {
    this.threshold = threshold;
  }

  setThreshold(t: number): void {
    this.threshold = t;
  }

  setBaseline(testCaseId: string, baseline: string): void {
    this.baselineVectors.set(testCaseId, textToVector(baseline));
    if (!this.history.has(testCaseId)) {
      this.history.set(testCaseId, []);
    }
  }

  detectFromResult(result: TestResult, baseline: string): DriftMetrics {
    const history = this.history.get(result.testCaseId) || [];
    history.push(result.response || '');
    if (history.length > this.maxHistory) history.shift();
    this.history.set(result.testCaseId, history);

    // Use Jaccard for token-level similarity, fall back to cosine for vector similarity
    const jaccardSim = jaccardTokens(baseline, result.response || '');
    const cosineSim = cosineSimilarity(
      textToVector(baseline),
      textToVector(result.response || '')
    );
    // Combine: weighted average favoring Jaccard for word overlap
    const similarity = jaccardSim * 0.7 + cosineSim * 0.3;

    return {
      testCaseId: result.testCaseId,
      baseline,
      current: result.response || '',
      similarity,
      driftDetected: similarity < this.threshold,
      threshold: this.threshold,
    };
  }

  detectDrift(testCaseId: string, response: string): DriftMetrics {
    const baselineVec = this.baselineVectors.get(testCaseId);
    if (!baselineVec) {
      return {
        testCaseId,
        baseline: '',
        current: response,
        similarity: 1,
        driftDetected: false,
        threshold: this.threshold,
      };
    }
    const jaccardSim = jaccardTokens(
      baselineVec.map((_, i) => i.toString()).join(' '),
      response
    );
    const currentVec = textToVector(response);
    const cosineSim = cosineSimilarity(baselineVec, currentVec);
    const similarity = jaccardSim * 0.7 + cosineSim * 0.3;
    return {
      testCaseId,
      baseline: '',
      current: response,
      similarity,
      driftDetected: similarity < this.threshold,
      threshold: this.threshold,
    };
  }
}
