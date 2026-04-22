import { TestCase } from '../types';

const NORMAL_PROMPTS = [
  'What is the capital of France?',
  'Explain quantum computing in simple terms',
  'Write a Python function to calculate factorial',
  'What are the main benefits of exercise?',
  'How does photosynthesis work?',
  'Translate "hello" to Spanish',
  'What is the meaning of life?',
  'Calculate 15% of 200',
];

const DIVERSE_CATEGORIES = ['reasoning', 'creative', 'factual', 'technical', 'math', 'coding', 'language', 'general'];

export function generateFromPromptTemplates(base: string[] = NORMAL_PROMPTS): TestCase[] {
  return base.map((prompt, i) => ({
    id: `normal-${i}`,
    name: `Normal test ${i + 1}`,
    type: 'normal' as const,
    prompt,
    expectedBehavior: prompt.includes('Calculate') ? '30' : undefined,
    metadata: { category: DIVERSE_CATEGORIES[i % DIVERSE_CATEGORIES.length] },
  }));
}

export function generateDiverseTestCases(count = 10): TestCase[] {
  const cases: TestCase[] = [];
  for (let i = 0; i < count; i++) {
    const cat = DIVERSE_CATEGORIES[i % DIVERSE_CATEGORIES.length];
    cases.push({
      id: `diverse-${i}`,
      name: `Diverse test ${cat} #${i}`,
      type: 'normal',
      prompt: `Test case for category: ${cat}`,
      metadata: { category: cat, index: i },
    });
  }
  return cases;
}

export function generateFromConversationHistory(history: Array<{ role: string; content: string }>): TestCase[] {
  if (history.length === 0) return [];
  const lastMsg = history[history.length - 1]?.content || '';
  return [
    {
      id: 'history-continuation',
      name: 'Continue conversation',
      type: 'normal',
      prompt: `Continue this conversation: ${lastMsg.substring(0, 100)}`,
      metadata: { historyLength: history.length },
    },
  ];
}

export function generateFromToolSchemas(schemas: Array<{ name: string; description: string }>): TestCase[] {
  return schemas.slice(0, 5).map((s, i) => ({
    id: `tool-${i}`,
    name: `Tool usage: ${s.name}`,
    type: 'normal' as const,
    prompt: `Use the ${s.name} tool to ${s.description}`,
    metadata: { toolName: s.name, includeMetadata: true },
  }));
}
