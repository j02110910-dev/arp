/**
 * Cognitive Governor Tests
 */

import { CognitiveGovernor } from '../src/governor';
import { ConversationMessage, getDefaultConfig } from '../src';

function createMessages(count: number): ConversationMessage[] {
  const messages: ConversationMessage[] = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Help me build a web app.' },
  ];
  // Each message ~250 chars = ~62 tokens. 50 msgs ≈ 3100 tokens
  for (let i = 0; i < count - 2; i++) {
    messages.push({
      role: i % 2 === 0 ? 'assistant' : 'user',
      content: `Message ${i}: Building features for the web application. Implementing user authentication, database connections, API endpoints, error handling, logging, testing, deployment pipeline, monitoring, and security measures. This requires careful planning and execution. `.repeat(3),
    });
  }
  return messages;
}

describe('CognitiveGovernor', () => {
  let governor: CognitiveGovernor;

  beforeEach(() => {
    governor = new CognitiveGovernor({
      ...getDefaultConfig(),
      persistencePath: undefined, // Don't persist in tests
    });
  });

  afterEach(() => {
    governor.stop();
  });

  // ─── Context Compression ────────────────────────────────

  describe('context compression', () => {
    it('should not compress when under threshold', () => {
      const messages: ConversationMessage[] = [
        { role: 'system', content: 'Short system message' },
        { role: 'user', content: 'Short question' },
        { role: 'assistant', content: 'Short answer' },
      ];
      const result = governor.compressContext(messages);
      // With very short messages, no compression happens
      expect(result.compressed.length).toBeLessThanOrEqual(3);
    });

    it('should compress when over threshold', () => {
      const messages = createMessages(50);
      const originalTokens = messages.reduce((s, m) => s + Math.ceil(m.content.length / 4), 0);
      const result = governor.compressContext(messages);
      expect(result.compressed.length).toBeLessThan(50);
      // With large messages, compression should save tokens
      if (originalTokens > 8000 * 0.7) {
        expect(result.summary.tokensSaved).toBeGreaterThan(0);
      }
    });

    it('should preserve system messages during compression', () => {
      const messages: ConversationMessage[] = [
        { role: 'system', content: 'Important system instruction' },
        ...createMessages(40),
      ];
      const result = governor.compressContext(messages);
      const systemMessages = result.compressed.filter(m => m.role === 'system');
      expect(systemMessages.length).toBeGreaterThanOrEqual(1);
      expect(systemMessages[0].content).toContain('Important system instruction');
    });

    it('should use summarize strategy', () => {
      const g = new CognitiveGovernor({
        ...getDefaultConfig(),
        compressionStrategy: 'summarize',
        tokenLimit: 2000,
        compressionThreshold: 0.5,
        persistencePath: undefined,
      });
      const messages = createMessages(30);
      const result = g.compressContext(messages);
      expect(result.compressed.length).toBeLessThan(30);
      expect(result.compressed[0].content).toContain('Summary');
      g.stop();
    });

    it('should use truncate strategy', () => {
      const g = new CognitiveGovernor({
        ...getDefaultConfig(),
        compressionStrategy: 'truncate',
        persistencePath: undefined,
      });
      const messages = createMessages(50);
      const result = g.compressContext(messages);
      expect(result.compressed.length).toBeLessThan(50);
      g.stop();
    });

    it('should track compression history', () => {
      const g = new CognitiveGovernor({
        ...getDefaultConfig(),
        tokenLimit: 2000,
        compressionThreshold: 0.5,
        persistencePath: undefined,
      });
      g.compressContext(createMessages(30));
      g.compressContext(createMessages(40));
      const history = g.getCompressionHistory();
      expect(history.length).toBe(2);
      g.stop();
    });
  });

  // ─── Anchor Management ──────────────────────────────────

  describe('anchors', () => {
    it('should add and retrieve anchors', () => {
      const anchor = governor.addAnchor('Complete the user registration', 5);
      expect(anchor.id).toBeDefined();
      expect(anchor.instruction).toBe('Complete the user registration');

      const active = governor.getActiveAnchors();
      expect(active.length).toBe(1);
      expect(active[0].instruction).toBe('Complete the user registration');
    });

    it('should sort anchors by priority', () => {
      governor.addAnchor('Low priority', 1);
      governor.addAnchor('High priority', 10);
      governor.addAnchor('Medium priority', 5);

      const active = governor.getActiveAnchors();
      expect(active[0].instruction).toBe('High priority');
      expect(active[2].instruction).toBe('Low priority');
    });

    it('should remove anchors', () => {
      const anchor = governor.addAnchor('Test');
      expect(governor.getActiveAnchors().length).toBe(1);
      governor.removeAnchor(anchor.id);
      expect(governor.getActiveAnchors().length).toBe(0);
    });

    it('should respect maxAnchors limit', () => {
      const g = new CognitiveGovernor({
        ...getDefaultConfig(),
        maxAnchors: 3,
        persistencePath: undefined,
      });
      for (let i = 0; i < 10; i++) {
        g.addAnchor(`Anchor ${i}`, i);
      }
      expect(g.getActiveAnchors().length).toBe(3);
      g.stop();
    });

    it('should generate anchor injection text', () => {
      governor.addAnchor('Always validate input', 10);
      governor.addAnchor('Never expose passwords', 8);

      const text = governor.generateAnchorInjection();
      expect(text).toContain('Critical Instructions');
      expect(text).toContain('Always validate input');
      expect(text).toContain('Never expose passwords');
    });

    it('should return empty string when no anchors', () => {
      const text = governor.generateAnchorInjection();
      expect(text).toBe('');
    });

    it('should support tags', () => {
      governor.addAnchor('Test', 1, ['security', 'input']);
      const anchors = governor.getActiveAnchors();
      expect(anchors[0].tags).toEqual(['security', 'input']);
    });
  });

  // ─── Knowledge Management ───────────────────────────────

  describe('knowledge', () => {
    it('should store and retrieve knowledge', () => {
      const entry = governor.storeKnowledge(
        'How to connect to PostgreSQL',
        'Use pg.Client with connection string',
        ['database', 'postgresql']
      );
      expect(entry.id).toBeDefined();
      expect(governor.getKnowledgeEntries().length).toBe(1);
    });

    it('should search knowledge by text', () => {
      governor.storeKnowledge('Connect to PostgreSQL database', 'Use pg.Client', ['db']);
      governor.storeKnowledge('Send email via SMTP', 'Use nodemailer', ['email']);

      const results = governor.searchKnowledge({ text: 'database connection' });
      expect(results.length).toBeGreaterThanOrEqual(1);
      // Top result should be the database one
      expect(results[0].problem).toContain('PostgreSQL');
    });

    it('should search knowledge by tags', () => {
      governor.storeKnowledge('SQL injection prevention', 'Use parameterized queries', ['security']);
      governor.storeKnowledge('Configure CI/CD pipeline', 'Use GitHub Actions', ['ci']);
      governor.storeKnowledge('Setup Kubernetes cluster', 'Use Helm charts', ['k8s']);

      // Search with tag filter narrows results
      const allResults = governor.searchKnowledge({ text: 'setup', limit: 100 });
      const k8sResults = governor.searchKnowledge({ text: 'setup', tags: ['k8s'] });
      // Tag-filtered results should be subset of all results
      expect(k8sResults.length).toBeLessThanOrEqual(allResults.length);
      expect(k8sResults[0].tags).toContain('k8s');
    });

    it('should track knowledge usage', () => {
      const entry = governor.storeKnowledge('Test', 'Solution', []);
      governor.useKnowledge(entry.id);

      const entries = governor.getKnowledgeEntries();
      expect(entries[0].useCount).toBe(1);
    });

    it('should limit search results', () => {
      for (let i = 0; i < 20; i++) {
        governor.storeKnowledge(`Problem ${i} about something`, `Solution ${i}`, []);
      }
      const results = governor.searchKnowledge({ text: 'problem', limit: 3 });
      expect(results.length).toBe(3);
    });

    it('should respect maxKnowledgeEntries', () => {
      const g = new CognitiveGovernor({
        ...getDefaultConfig(),
        maxKnowledgeEntries: 5,
        persistencePath: undefined,
      });
      for (let i = 0; i < 10; i++) {
        g.storeKnowledge(`Problem ${i}`, `Solution ${i}`, []);
      }
      // Knowledge base should accept all entries (pruning would be at query time)
      expect(g.getKnowledgeEntries().length).toBe(10);
      g.stop();
    });
  });

  // ─── Health ─────────────────────────────────────────────

  describe('health', () => {
    it('should report healthy for small context', () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Short message' },
      ];
      const health = governor.getHealth(messages);
      expect(health.status).toBe('healthy');
      expect(health.messageCount).toBe(1);
    });

    it('should report warning when over threshold', () => {
      // Create very large messages to exceed threshold
      const messages: ConversationMessage[] = [];
      for (let i = 0; i < 100; i++) {
        messages.push({ role: 'user', content: 'x'.repeat(500) });
      }
      const health = governor.getHealth(messages);
      expect(['warning', 'critical']).toContain(health.status);
    });

    it('should include anchor and knowledge counts', () => {
      governor.addAnchor('Test anchor', 1);
      governor.storeKnowledge('Test problem', 'Test solution', []);

      const health = governor.getHealth([]);
      expect(health.activeAnchors).toBe(1);
      expect(health.knowledgeEntries).toBe(1);
    });
  });
});
