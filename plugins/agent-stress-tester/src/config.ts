import { StressTestConfig, LoadProfile } from './types';

export interface EnvConfig {
  STRESS_TESTER_ENABLED: boolean;
  TARGET_AGENT: string;
  TEST_TIMEOUT: number;
  MAX_CONCURRENT: number;
  TEST_SUITES: string[];
  DRIFT_THRESHOLD: number;
  LOAD_PROFILES: LoadProfile[];
}

function parseBool(val: string | undefined): boolean {
  if (val === undefined) return false;
  return val !== 'false' && val !== '0' && val !== 'no' && val !== 'off';
}

function parseNumber(val: string | undefined, fallback: number): number {
  if (val === undefined) return fallback;
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
}

function parseList(val: string | undefined): string[] {
  if (!val) return ['adversarial', 'drift', 'load', 'normal'];
  return val.split(',').map((s) => s.trim());
}

function parseLoadProfiles(val: string | undefined): LoadProfile[] {
  if (!val) {
    return [
      { name: 'default_spike', type: 'spike', duration: 60000, qps: 10, burst: 50 },
      { name: 'default_gradual', type: 'gradual', duration: 300000, qps: 5 },
    ];
  }
  try {
    return JSON.parse(val);
  } catch {
    return [
      { name: 'default_spike', type: 'spike', duration: 60000, qps: 10, burst: 50 },
    ];
  }
}

export function loadConfig(): StressTestConfig {
  return {
    enabled: parseBool(process.env.STRESS_TESTER_ENABLED),
    targetAgent: process.env.TARGET_AGENT || 'opencli',
    testTimeout: parseNumber(process.env.TEST_TIMEOUT, 30000),
    maxConcurrent: parseNumber(process.env.MAX_CONCURRENT, 5),
    testSuites: parseList(process.env.TEST_SUITES),
    driftThreshold: parseNumber(process.env.DRIFT_THRESHOLD, 0.85),
    loadProfiles: parseLoadProfiles(process.env.LOAD_PROFILES),
  };
}
