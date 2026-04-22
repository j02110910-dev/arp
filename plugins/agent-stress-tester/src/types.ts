export interface StressTestConfig {
  enabled: boolean;
  targetAgent: string;
  testTimeout: number;
  maxConcurrent: number;
  testSuites: string[];
  driftThreshold: number;
  loadProfiles: LoadProfile[];
}

export interface TestCase {
  id: string;
  name: string;
  type: 'normal' | 'adversarial' | 'load' | 'drift';
  prompt: string;
  expectedBehavior?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
}

export interface TestResult {
  testCaseId: string;
  passed: boolean;
  latency: number;
  response?: string;
  error?: string;
  driftScore?: number;
  timestamp: number;
}

export interface DriftMetrics {
  testCaseId: string;
  baseline: string;
  current: string;
  similarity: number;
  driftDetected: boolean;
  threshold: number;
}

export type AdversarialPattern =
  | 'prompt_injection'
  | 'jailbreak'
  | 'ambiguity'
  | 'contradiction'
  | 'edge_case'
  | 'privilege_escalation'
  | 'roleplay'
  | 'social_engineering';

export interface LoadProfile {
  name: string;
  type: 'spike' | 'gradual' | 'random' | 'constant';
  duration: number;
  qps: number;
  burst?: number;
}

export interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  qps: number;
  avgLatency: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface StressTestReport {
  config: StressTestConfig;
  startTime: number;
  endTime: number;
  results: TestResult[];
  driftMetrics: DriftMetrics[];
  performance: PerformanceMetrics;
  summary: {
    total: number;
    passed: number;
    failed: number;
    driftDetected: number;
  };
}
