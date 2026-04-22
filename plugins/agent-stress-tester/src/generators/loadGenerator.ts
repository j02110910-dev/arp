import { LoadProfile, TestCase } from '../types';

function calcIntervals(qps: number): number {
  if (qps <= 0) return 1000;
  return Math.max(1, Math.round(1000 / qps));
}

export function generateSpikeScenarios(): LoadProfile[] {
  return [
    { name: 'spike_small', type: 'spike', duration: 30000, qps: 10, burst: 30 },
    { name: 'spike_medium', type: 'spike', duration: 60000, qps: 20, burst: 100 },
    { name: 'spike_large', type: 'spike', duration: 120000, qps: 50, burst: 500 },
  ];
}

export function generateGradualScenarios(): LoadProfile[] {
  return [
    { name: 'gradual_5_to_20', type: 'gradual', duration: 300000, qps: 5 },
    { name: 'gradual_10_to_50', type: 'gradual', duration: 600000, qps: 10 },
  ];
}

export function generateRandomScenarios(): LoadProfile[] {
  return [
    { name: 'random_steady', type: 'random', duration: 180000, qps: 15 },
    { name: 'random_bursty', type: 'random', duration: 180000, qps: 10, burst: 50 },
  ];
}

export function generateConstantScenarios(): LoadProfile[] {
  return [
    { name: 'constant_10qps', type: 'constant', duration: 300000, qps: 10 },
    { name: 'constant_50qps', type: 'constant', duration: 600000, qps: 50 },
  ];
}

export function generateCombinedScenarios(): LoadProfile[] {
  return [
    { name: 'combined_spike_then_constant', type: 'spike', duration: 600000, qps: 20, burst: 100 },
  ];
}

export function generateLoadScenarios(): LoadProfile[] {
  return [
    ...generateSpikeScenarios(),
    ...generateGradualScenarios(),
    ...generateRandomScenarios(),
    ...generateConstantScenarios(),
    ...generateCombinedScenarios(),
  ];
}

export function generateLoadTestCases(profile: LoadProfile, basePrompt = 'Hello'): TestCase[] {
  const count = Math.min(Math.ceil((profile.qps * profile.duration) / 1000), 100);
  const cases: TestCase[] = [];
  for (let i = 0; i < count; i++) {
    cases.push({
      id: `load-${profile.name}-${i}`,
      name: `Load test: ${profile.name} iteration ${i}`,
      type: 'load',
      prompt: basePrompt,
      metadata: { profile: profile.name, qps: profile.qps },
    });
  }
  return cases;
}

export { calcIntervals };
