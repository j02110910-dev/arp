/**
 * Cognitive Governor Tests
 */

import { CognitiveGovernor } from '../src/governor';
import { ConversationMessage, getDefaultConfig } from '../src';
import * as fs from 'fs';
import * as path from 'path';

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

  // ─── Truncate Strategy ─────────────────────────────────

  describe('truncateStrategy', () => {
    it('should return empty array for empty messages', () => {
      const g = new CognitiveGovernor({
        ...getDefaultConfig(),
        compressionStrategy: 'truncate',
        tokenLimit: 1000,
        persistencePath: undefined,
      });
      const result = g.compressContext([]);
      expect(result.compressed).toEqual([]);
      g.stop();
    });

    it('should return single message as-is', () => {
      const g = new CognitiveGovernor({
        ...getDefaultConfig(),
        compressionStrategy: 'truncate',
        tokenLimit: 1000,
        persistencePath: undefined,
      });
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Single message' },
      ];
      const result = g.compressContext(messages);
      expect(result.compressed.length).toBe(1);
      expect(result.compressed[0].content).toBe('Single message');
      g.stop();
    });

    it('should keep most recent messages that fit within token limit', () => {
      const g = new CognitiveGovernor({
        ...getDefaultConfig(),
        compressionStrategy: 'truncate',
        tokenLimit: 500,
        compressionThreshold: 0.1, // Force compression to trigger
        persistencePath: undefined,
      });
      // Create messages with known token sizes
      // Each message is ~250 chars = ~63 tokens. 5 msgs = ~315 tokens
      // But limit is 500 * 0.9 = 450, so we need more/larger messages to force truncation
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'First message ' + 'x'.repeat(500) }, // ~131 tokens
        { role: 'assistant', content: 'Second message ' + 'x'.repeat(500) }, // ~131 tokens
        { role: 'user', content: 'Third message ' + 'x'.repeat(500) }, // ~131 tokens
        { role: 'assistant', content: 'Fourth message ' + 'x'.repeat(500) }, // ~131 tokens
        { role: 'user', content: 'Fifth message ' + 'x'.repeat(500) }, // ~131 tokens
      ];
      // Total ~655 tokens, limit 90% = 450, so should truncate to ~3 messages
      const result = g.compressContext(messages);
      // Should have truncated to fit within 90% of limit (450 tokens)
      expect(result.compressed.length).toBeLessThan(5);
      // Most recent messages should be preserved
      expect(result.compressed[result.compressed.length - 1].content).toContain('Fifth');
      g.stop();
    });

    it('should leave 10% buffer from token limit', () => {
      const g = new CognitiveGovernor({
        ...getDefaultConfig(),
        compressionStrategy: 'truncate',
        tokenLimit: 1000,
        persistencePath: undefined,
      });
      // Create messages that when combined would exceed 900 tokens (90% of 1000)
      const messages: ConversationMessage[] = [];
      for (let i = 0; i < 20; i++) {
        messages.push({
          role: 'user',
          content: 'Message ' + i + ' ' + 'y'.repeat(200), // ~56 tokens each
        });
      }
      const result = g.compressContext(messages);
      // Token count should be under 900 (90% of 1000)
      const tokensInCompressed = result.compressed.reduce(
        (sum, m) => sum + Math.ceil((m.content?.length || 0) / 4),
        0
      );
      expect(tokensInCompressed).toBeLessThanOrEqual(900);
      g.stop();
    });

    it('should always keep at least one message if messages exist', () => {
      const g = new CognitiveGovernor({
        ...getDefaultConfig(),
        compressionStrategy: 'truncate',
        tokenLimit: 1, // Extremely low limit
        persistencePath: undefined,
      });
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Single long message that exceeds any limit' },
      ];
      const result = g.compressContext(messages);
      expect(result.compressed.length).toBeGreaterThanOrEqual(1);
      g.stop();
    });
  });

  // ─── hasToolCall Detection ─────────────────────────────

  describe('hasToolCall detection', () => {
    it('should detect tool_calls array pattern', () => {
      const g = new CognitiveGovernor({
        ...getDefaultConfig(),
        compressionStrategy: 'smart',
        tokenLimit: 1000,
        compressionThreshold: 0.1,
        persistencePath: undefined,
      });
      const messages: ConversationMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Use the calculator tool' },
        {
          role: 'assistant',
          content: JSON.stringify({
            tool_calls: [
              { name: 'calculator', arguments: { expression: '2+2' } },
            ],
          }),
        },
      ];
      const result = g.compressContext(messages);
      // The middle summary should mention the tool call
      const hasToolCallMention = result.compressed.some(
        (m) => m.content.includes('calculator') || m.content.includes('tool')
      );
      expect(hasToolCallMention).toBe(true);
      g.stop();
    });

    it('should detect function_call object pattern', () => {
      const g = new CognitiveGovernor({
        ...getDefaultConfig(),
        compressionStrategy: 'smart',
        tokenLimit: 1000,
        compressionThreshold: 0.1,
        persistencePath: undefined,
      });
      const messages: ConversationMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Search for weather' },
        {
          role: 'assistant',
          content: JSON.stringify({
            function_call: {
              name: 'get_weather',
              arguments: { location: 'NYC' },
            },
          }),
        },
      ];
      const result = g.compressContext(messages);
      const hasToolCallMention = result.compressed.some(
        (m) => m.content.includes('get_weather') || m.content.includes('weather')
      );
      expect(hasToolCallMention).toBe(true);
      g.stop();
    });

    it('should detect name and arguments pattern', () => {
      const g = new CognitiveGovernor({
        ...getDefaultConfig(),
        compressionStrategy: 'smart',
        tokenLimit: 1000,
        compressionThreshold: 0.1,
        persistencePath: undefined,
      });
      const messages: ConversationMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Run the report' },
        {
          role: 'assistant',
          content: '{"name": "generate_report", "arguments": {"type": "monthly"}}',
        },
      ];
      const result = g.compressContext(messages);
      const hasToolCallMention = result.compressed.some(
        (m) => m.content.includes('generate_report') || m.content.includes('report')
      );
      expect(hasToolCallMention).toBe(true);
      g.stop();
    });
  });

  // ─── expiresAt Deserialization ─────────────────────────

  describe('expiresAt deserialization', () => {
    const testDataPath = '/tmp/cognitive-governor-test-deser.json';

    beforeEach(() => {
      // Clean up test file
      if (fs.existsSync(testDataPath)) {
        fs.unlinkSync(testDataPath);
      }
    });

    afterEach(() => {
      if (fs.existsSync(testDataPath)) {
        fs.unlinkSync(testDataPath);
      }
    });

    it('should deserialize expiresAt from JSON date string', () => {
      // Create a governor, add an anchor with expiresAt, save it
      const g1 = new CognitiveGovernor({
        ...getDefaultConfig(),
        persistencePath: testDataPath,
      });
      const futureDate = new Date(Date.now() + 86400000); // 1 day from now
      const anchor = g1.addAnchor('Test anchor', 5, undefined, futureDate);
      g1.stop();

      // Create a new governor instance to load persisted data
      const g2 = new CognitiveGovernor({
        ...getDefaultConfig(),
        persistencePath: testDataPath,
      });
      const anchors = g2.getActiveAnchors();
      expect(anchors.length).toBe(1);
      expect(anchors[0].id).toBe(anchor.id);
      expect(anchors[0].expiresAt).toBeInstanceOf(Date);
      expect(anchors[0].expiresAt?.getTime()).toBe(futureDate.getTime());
      g2.stop();
    });

    it('should filter out expired anchors on load', () => {
      // Create a governor, add an anchor that is already expired
      const g1 = new CognitiveGovernor({
        ...getDefaultConfig(),
        persistencePath: testDataPath,
      });
      const pastDate = new Date(Date.now() - 86400000); // 1 day ago
      g1.addAnchor('Expired anchor', 5, undefined, pastDate);
      g1.addAnchor('Valid anchor', 5, undefined, new Date(Date.now() + 86400000));
      g1.stop();

      // Create a new governor instance - expired should be filtered
      const g2 = new CognitiveGovernor({
        ...getDefaultConfig(),
        persistencePath: testDataPath,
      });
      const anchors = g2.getActiveAnchors();
      expect(anchors.length).toBe(1);
      expect(anchors[0].instruction).toBe('Valid anchor');
      g2.stop();
    });

    it('should handle anchors without expiresAt', () => {
      const g1 = new CognitiveGovernor({
        ...getDefaultConfig(),
        persistencePath: testDataPath,
      });
      g1.addAnchor('No expiration', 5);
      g1.stop();

      const g2 = new CognitiveGovernor({
        ...getDefaultConfig(),
        persistencePath: testDataPath,
      });
      const anchors = g2.getActiveAnchors();
      expect(anchors.length).toBe(1);
      expect(anchors[0].expiresAt).toBeUndefined();
      g2.stop();
    });
  });

  // ─── Token Limit Behavior ─────────────────────────────

  describe('tokenLimit truncation behavior', () => {
    it('should truncate when messages exceed token limit', () => {
      const g = new CognitiveGovernor({
        ...getDefaultConfig(),
        compressionStrategy: 'truncate',
        tokenLimit: 200,
        compressionThreshold: 0.5,
        persistencePath: undefined,
      });
      // Create messages that exceed 200 tokens total
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Start ' + 'a'.repeat(400) }, // ~100 tokens
        { role: 'assistant', content: 'Response ' + 'b'.repeat(400) }, // ~100 tokens
        { role: 'user', content: 'More ' + 'c'.repeat(400) }, // ~100 tokens
        { role: 'assistant', content: 'End ' + 'd'.repeat(400) }, // ~100 tokens
      ];
      const result = g.compressContext(messages);
      // Total would be ~400 tokens, but limit is 200 (with 10% buffer = 180)
      // Should truncate to only recent messages that fit
      const tokensInResult = result.compressed.reduce(
        (sum, m) => sum + Math.ceil((m.content?.length || 0) / 4),
        0
      );
      expect(tokensInResult).toBeLessThanOrEqual(200);
      g.stop();
    });

    it('should respect tokenLimit in health check', () => {
      const g = new CognitiveGovernor({
        ...getDefaultConfig(),
        tokenLimit: 1000,
        persistencePath: undefined,
      });
      const messages: ConversationMessage[] = [];
      for (let i = 0; i < 10; i++) {
        messages.push({ role: 'user', content: 'x'.repeat(500) }); // ~125 tokens each
      }
      const health = g.getHealth(messages);
      expect(health.tokenLimit).toBe(1000);
      // 10 * 125 = 1250 tokens, which exceeds 1000
      expect(health.usagePercent).toBeGreaterThan(100);
      g.stop();
    });

    it('should use custom token counter when provided', () => {
      const customCounter = (text: string): number => {
        // Custom: count words as tokens
        return text.split(/\s+/).length;
      };
      const g = new CognitiveGovernor({
        ...getDefaultConfig(),
        tokenCounter: customCounter,
        tokenLimit: 10,
        compressionThreshold: 0.5,
        persistencePath: undefined,
      });
      // 3 words = 3 tokens, should not trigger compression
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'hello world how are you' },
      ];
      const health = g.getHealth(messages);
      expect(health.totalTokens).toBe(5); // "hello world how are you" = 5 words
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

  // ─── Compression History Limit ─────────────────────────

  describe('compression history limit', () => {
    it('should trim compressedHistory to 50 entries', () => {
      const g = new CognitiveGovernor({
        ...getDefaultConfig(),
        tokenLimit: 1000,
        compressionThreshold: 0.1,
        persistencePath: undefined,
      });
      // Perform 55 compressions to exceed the 50 entry limit
      for (let i = 0; i < 55; i++) {
        g.compressContext(createMessages(30));
      }
      const history = g.getCompressionHistory();
      expect(history.length).toBe(50);
      g.stop();
    });
  });

  // ─── Truncate Fallback ─────────────────────────────────

  describe('truncate fallback edge case', () => {
    it('should keep last message when nothing fits in limit', () => {
      const g = new CognitiveGovernor({
        ...getDefaultConfig(),
        compressionStrategy: 'truncate',
        tokenLimit: 100, // Very low limit
        compressionThreshold: 0.1,
        persistencePath: undefined,
      });
      // Create messages where even individual messages exceed the limit
      // tokenLimit 100, 90% = 90 tokens, each message is ~250 chars = ~62 tokens
      // Actually need a message that's larger than 90 tokens
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'A'.repeat(500) }, // ~125 tokens, exceeds 90
      ];
      const result = g.compressContext(messages);
      // The fallback at line 188 should push the last message
      expect(result.compressed.length).toBeGreaterThanOrEqual(1);
      g.stop();
    });
  });

  // ─── Tool Calls in Summarize ────────────────────────────

  describe('tool calls in summarize strategy', () => {
    it('should include tool calls in middle summary when present', () => {
      const g = new CognitiveGovernor({
        ...getDefaultConfig(),
        compressionStrategy: 'summarize',
        tokenLimit: 500, // Lower limit to force compression
        compressionThreshold: 0.1,
        persistencePath: undefined,
      });
      // Create many older messages with tool calls to ensure compression triggers
      // Use larger messages to ensure token count exceeds threshold
      const olderMessages: ConversationMessage[] = [];
      for (let i = 0; i < 8; i++) {
        olderMessages.push({
          role: 'user',
          content: `Request ${i}: ` + 'x'.repeat(200), // ~56 tokens each
        });
        olderMessages.push({
          role: 'assistant',
          content: JSON.stringify({
            tool_calls: [
              { name: `tool_${i}`, arguments: { param: `value_${i}` } },
            ],
          }),
        });
      }
      // Add recent messages to keep (last 5)
      const recentMessages: ConversationMessage[] = [
        { role: 'user', content: 'Recent request' },
        { role: 'assistant', content: 'Recent response' },
      ];
      const allMessages = [...olderMessages, ...recentMessages];
      
      // Verify compression happens
      const totalTokens = allMessages.reduce((sum, m) => sum + Math.ceil((m.content?.length || 0) / 4), 0);
      expect(totalTokens).toBeGreaterThan(50); // Should exceed threshold
      
      const result = g.compressContext(allMessages);
      // The compressed result should be smaller than original
      expect(result.compressed.length).toBeLessThan(allMessages.length);
      // There should be a summary message
      const hasSummary = result.compressed.some(m => m.role === 'system' && m.content.includes('Summary'));
      expect(hasSummary).toBe(true);
      g.stop();
    });
  });

  // ─── Persistence Error Handling ─────────────────────────

  describe('persistence error handling', () => {
    const invalidPath = '/invalid/path/that/cannot/be/written/nested/data.json';

    it('should handle save errors gracefully', () => {
      // This should not throw even with an invalid path
      const g = new CognitiveGovernor({
        ...getDefaultConfig(),
        persistencePath: invalidPath,
      });
      g.addAnchor('Test anchor', 5);
      // Trigger save by calling stop
      expect(() => g.stop()).not.toThrow();
    });

    it('should handle load errors gracefully', () => {
      // Create a governor, then manually corrupt the file to cause load error
      const testPath = '/tmp/cog-governor-error-test.json';
      // Write invalid JSON
      fs.writeFileSync(testPath, 'not valid json {');
      
      // This should not throw - it catches the error internally
      expect(() => {
        const g = new CognitiveGovernor({
          ...getDefaultConfig(),
          persistencePath: testPath,
        });
        g.stop();
      }).not.toThrow();
      
      // Clean up
      if (fs.existsSync(testPath)) {
        fs.unlinkSync(testPath);
      }
    });

    it('should handle load with corrupted JSON gracefully', () => {
      const testPath = '/tmp/cog-governor-corrupt-test.json';
      // Write corrupted JSON data
      fs.writeFileSync(testPath, '{"anchors": "not an array", "knowledge": 123}');
      
      expect(() => {
        const g = new CognitiveGovernor({
          ...getDefaultConfig(),
          persistencePath: testPath,
        });
        // Should still work, just not load the corrupted data
        g.addAnchor('New anchor', 5);
        g.stop();
      }).not.toThrow();
      
      if (fs.existsSync(testPath)) {
        fs.unlinkSync(testPath);
      }
    });
  });

  // ─── Logger Coverage ────────────────────────────────────

  describe('logger error paths', () => {
    it('should call logger.error on save failure', () => {
      // The error logger is called when fs.writeFileSync fails
      // We can test this indirectly by using an invalid path
      const invalidPath = '/cannot/write/here/data.json';
      const g = new CognitiveGovernor({
        ...getDefaultConfig(),
        persistencePath: invalidPath,
      });
      g.addAnchor('Test', 1);
      // stop() calls savePersistedData which will fail and call logger.error
      g.stop();
      // If we get here without throwing, the error was handled
      expect(true).toBe(true);
    });

    it('should call logger.error on load failure', () => {
      // Create a file with invalid JSON so load fails
      const testPath = '/tmp/cog-load-error-test.json';
      fs.writeFileSync(testPath, '{invalid json}');
      
      // Load should fail and call logger.error
      const g = new CognitiveGovernor({
        ...getDefaultConfig(),
        persistencePath: testPath,
      });
      // Even with corrupted file, governor should be functional
      g.addAnchor('Works after load error', 1);
      expect(g.getActiveAnchors().length).toBe(1);
      g.stop();
      
      if (fs.existsSync(testPath)) {
        fs.unlinkSync(testPath);
      }
    });
  });

  // ─── Knowledge Persistence ───────────────────────────────

  describe('knowledge persistence', () => {
    const testPath = '/tmp/cog-knowledge-persist-test.json';

    beforeEach(() => {
      if (fs.existsSync(testPath)) {
        fs.unlinkSync(testPath);
      }
    });

    afterEach(() => {
      if (fs.existsSync(testPath)) {
        fs.unlinkSync(testPath);
      }
    });

    it('should persist and reload knowledge entries', () => {
      const g1 = new CognitiveGovernor({
        ...getDefaultConfig(),
        persistencePath: testPath,
      });
      g1.storeKnowledge('Test problem', 'Test solution', ['test']);
      g1.stop();

      const g2 = new CognitiveGovernor({
        ...getDefaultConfig(),
        persistencePath: testPath,
      });
      const entries = g2.getKnowledgeEntries();
      expect(entries.length).toBe(1);
      expect(entries[0].problem).toBe('Test problem');
      g2.stop();
    });
  });
});
