/**
 * ARP Unified Package - Integration Tests
 */

import { ARP, TeamARP } from '../src/index';

describe('ARP Unified Package', () => {
  let arp: ARP;

  beforeEach(() => {
    arp = new ARP({
      enabled: true,
      alertHistoryPath: undefined,
      dataPath: undefined,
    });
  });

  afterEach(() => {
    arp.stop();
  });

  // ─── SilentWatch Integration ──────────────────────────

  describe('watch (SilentWatch)', () => {
    it('should record tool calls and get stats', () => {
      arp.watch.recordToolCall('search', { q: 'test' }, ['result'], 100);
      arp.watch.recordResponse('Found results');

      const stats = arp.watch.stats();
      expect(stats.totalEvents).toBe(2);
      expect(stats.totalAlerts).toBe(0);
    });

    it('should detect loops', () => {
      for (let i = 0; i < 12; i++) {
        arp.watch.recordToolCall('retry', {}, 'same', 50);
      }
      const stats = arp.watch.stats();
      expect(stats.alertsByType.loop_detected).toBeGreaterThanOrEqual(1);
    });

    it('should return health status', () => {
      const health = arp.watch.health();
      expect(health.status).toBe('healthy');
    });
  });

  // ─── Output Verifier Integration ──────────────────────

  describe('verify (Output Verifier)', () => {
    it('should verify output with schema', async () => {
      const result = await arp.verify(
        { output: { name: 'Alice', age: 30 } },
        { schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } }
      );
      expect(result.status).toBe('passed');
    });

    it('should detect missing required fields', async () => {
      const result = await arp.verify(
        { output: { name: 'Alice' } },
        { requiredFields: ['name', 'email'] }
      );
      expect(result.status).not.toBe('passed');
    });

    it('should verify a full claim', async () => {
      const result = await arp.verify({
        description: 'Created user',
        output: { userId: 42 },
        toolCalls: [{ tool: 'create_user', result: { id: 42 } }],
      });
      expect(result.score).toBeGreaterThan(0);
    });
  });

  // ─── Cognitive Governor Integration ───────────────────

  describe('memory (Cognitive Governor)', () => {
    it('should compress context', () => {
      const messages = Array.from({ length: 20 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: 'Building the authentication system with JWT tokens. '.repeat(20),
      }));

      const result = arp.compress(messages);
      expect(result.messages.length).toBeLessThanOrEqual(20);
    });

    it('should manage anchors', () => {
      const a = arp.anchor('Complete registration', 10);
      expect(a.id).toBeDefined();
      expect(arp.anchorText()).toContain('Complete registration');

      arp.unanchor(a.id);
      expect(arp.anchorText()).toBe('');
    });

    it('should store and search knowledge', () => {
      arp.learn('JWT refresh not working', 'Use refresh token rotation', ['auth']);
      const results = arp.recall('JWT refresh');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should report context health', () => {
      const health = arp.contextHealth([]);
      expect(health.status).toBe('healthy');
    });
  });

  // ─── Permission Sentinel Integration ──────────────────

  describe('guard (Permission Sentinel)', () => {
    it('should allow safe commands', () => {
      const result = arp.guard('ls -la');
      expect(result.allowed).toBe(true);
    });

    it('should block dangerous commands', () => {
      const result = arp.guard('rm -rf /');
      expect(result.allowed).toBe(false);
    });

    it('should sanitize sensitive data', () => {
      const result = arp.sanitize('Phone: 13812345678, Email: alice@test.com');
      expect(result.wasModified).toBe(true);
      expect(result.sanitized).toContain('[PHONE_REDACTED]');
      expect(result.sanitized).toContain('[EMAIL_REDACTED]');
    });

    it('should return guard stats', () => {
      arp.guard('ls');
      arp.guard('rm -rf /');
      const stats = arp.guardStats();
      expect(stats.totalChecked).toBe(2);
    });
  });

  // ─── Cross-plugin Integration ─────────────────────────

  describe('cross-plugin integration', () => {
    it('should work end-to-end: watch → verify → learn', async () => {
      // 1. Watch records a tool call
      arp.watch.recordToolCall('create_user', { name: 'Bob' }, { id: 42 }, 100);
      arp.watch.recordResponse('User created successfully');

      // 2. Verify the output
      const result = await arp.verify(
        { output: { id: 42 } },
        { requiredFields: ['id'] }
      );
      expect(result.status).toBe('passed');

      // 3. Learn from the experience
      arp.learn('User creation', 'Always return { id } in output', ['user-management']);
      const knowledge = arp.recall('user creation');
      expect(knowledge.length).toBeGreaterThanOrEqual(1);

      // 4. No alerts
      expect(arp.watch.stats().totalAlerts).toBe(0);
    });

    it('should work end-to-end: guard → sanitize → anchor', () => {
      // 1. Check command safety
      const check = arp.guard('curl https://api.com/data');
      expect(check.requiresConfirmation).toBe(true);

      // 2. Sanitize data before logging
      const sanitized = arp.sanitize('API response from 192.168.1.1 for user@example.com');
      expect(sanitized.wasModified).toBe(true);

      // 3. Anchor the security policy
      arp.anchor('Always sanitize before logging', 10, ['security']);
      expect(arp.anchorText()).toContain('sanitize');
    });
  });
});

describe('TeamARP', () => {
  let team: TeamARP;

  beforeEach(() => {
    team = new TeamARP();
  });

  afterEach(() => {
    team.stop();
  });

  it('should add and manage agents', () => {
    const bot1 = team.addAgent('frontend-bot');
    const bot2 = team.addAgent('backend-bot');

    expect(team.listAgents().length).toBe(2);
    expect(team.getAgent('frontend-bot')).toBe(bot1);
    expect(team.getAgent('backend-bot')).toBe(bot2);
  });

  it('should collect stats from all agents', () => {
    const bot1 = team.addAgent('bot-a');
    const bot2 = team.addAgent('bot-b');

    bot1.watch.recordToolCall('search', {}, 'r', 100);
    bot2.watch.recordToolCall('fetch', {}, 'r', 200);

    const stats = team.getAllStats();
    expect(stats['bot-a'].totalEvents).toBe(1);
    expect(stats['bot-b'].totalEvents).toBe(1);
  });

  it('should collect alerts from all agents', () => {
    const bot1 = team.addAgent('bot-a');
    bot1.watch.recordToolCall('retry', {}, 'same', 50);
    for (let i = 0; i < 12; i++) {
      bot1.watch.recordToolCall('retry', {}, 'same', 50);
    }

    const alerts = team.getAllAlerts(10);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].agent).toBe('bot-a');
  });

  it('should remove agents', () => {
    team.addAgent('temp');
    expect(team.listAgents().length).toBe(1);
    team.removeAgent('temp');
    expect(team.listAgents().length).toBe(0);
  });

  it('should start dashboard', async () => {
    team.addAgent('test-bot');
    await team.dashboard(13333);  // Use unusual port to avoid conflicts

    // Verify dashboard is running
    const response = await fetch('http://localhost:13333/api/agents');
    const data = await response.json() as { agents: Array<{ name: string }> };
    expect(data.agents.length).toBe(1);
    expect(data.agents[0].name).toBe('test-bot');

    team.stop();
  });
});
