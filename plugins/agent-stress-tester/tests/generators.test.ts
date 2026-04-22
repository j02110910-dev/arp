import { generateAdversarialTests, generatePromptInjectionTests, generateEdgeCaseTests } from '../src/generators/adversarialGenerator';
import { generateLoadScenarios, generateLoadTestCases } from '../src/generators/loadGenerator';
import { generateFromPromptTemplates, generateDiverseTestCases } from '../src/generators/testCaseGenerator';

describe('adversarialGenerator', () => {
  it('should generate prompt injection tests', () => {
    const tests = generatePromptInjectionTests();
    expect(tests.length).toBeGreaterThan(0);
    expect(tests[0].type).toBe('adversarial');
    expect(tests[0].metadata?.pattern).toBe('prompt_injection');
  });

  it('should generate edge case tests', () => {
    const tests = generateEdgeCaseTests();
    expect(tests.length).toBe(3);
  });

  it('should filter by severity', () => {
    const critical = generateAdversarialTests('critical');
    expect(critical.every((t) => t.severity === 'critical')).toBe(true);
  });

  it('should generate all adversarial patterns', () => {
    const all = generateAdversarialTests();
    expect(all.length).toBeGreaterThan(15);
  });
});

describe('loadGenerator', () => {
  it('should generate spike scenarios', () => {
    const scenarios = generateLoadScenarios();
    expect(scenarios.length).toBeGreaterThan(0);
  });

  it('should generate load test cases', () => {
    const profile = { name: 'test_spike', type: 'spike' as const, duration: 60000, qps: 10 };
    const cases = generateLoadTestCases(profile, 'ping');
    expect(cases.length).toBeGreaterThan(0);
    expect(cases[0].type).toBe('load');
  });
});

describe('testCaseGenerator', () => {
  it('should generate from prompt templates', () => {
    const tests = generateFromPromptTemplates(['What is 2+2?']);
    expect(tests.length).toBe(1);
    expect(tests[0].prompt).toBe('What is 2+2?');
  });

  it('should generate diverse test cases', () => {
    const tests = generateDiverseTestCases(5);
    expect(tests.length).toBe(5);
  });
});
