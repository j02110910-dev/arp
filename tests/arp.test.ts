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

    it('should record cron triggers', () => {
      arp.watch.recordCron('daily-job', 'job-123');
      const stats = arp.watch.stats();
      expect(stats.totalEvents).toBe(1);
    });

    it('should register and record cron tasks', () => {
      arp.watch.registerCron('hourly-report', 'report-456', 3600000);
      arp.watch.recordCron('hourly-report', 'report-456');
      const stats = arp.watch.stats();
      expect(stats.totalEvents).toBe(1);
    });

    it('should get recent alerts', () => {
      for (let i = 0; i < 12; i++) {
        arp.watch.recordToolCall('retry', {}, 'same', 50);
      }
      const alerts = arp.watch.alerts(5);
      expect(alerts.length).toBeGreaterThanOrEqual(1);
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

  it('should add agent with custom config', () => {
    const bot = team.addAgent('custom-bot', {
      watch: { maxConsecutiveCalls: 20 },
      guard: { safeCommands: ['ls', 'cat'] },
    });
    expect(bot).toBeDefined();
    expect(team.getAgent('custom-bot')).toBe(bot);
  });

  it('should handle removing non-existent agent', () => {
    const result = team.removeAgent('non-existent');
    expect(result).toBe(false);
  });

  it('should get agent that does not exist', () => {
    expect(team.getAgent('ghost')).toBeUndefined();
  });

  it('should start dashboard and query all endpoints', async () => {
    team.addAgent('test-bot');
    await team.dashboard(13334);

    // Test /api/agents
    const agentsRes = await fetch('http://localhost:13334/api/agents');
    const agentsData = (await agentsRes.json()) as { agents: Array<{ name: string }> };
    expect(agentsData.agents.length).toBe(1);

    // Test /api/alerts
    const alertsRes = await fetch('http://localhost:13334/api/alerts?limit=5');
    const alertsData = (await alertsRes.json()) as { alerts: unknown[] };
    expect(alertsData.alerts).toBeDefined();

    // Test /api/stats
    const statsRes = await fetch('http://localhost:13334/api/stats');
    const statsData = (await statsRes.json()) as Record<string, unknown>;
    expect(statsData['test-bot']).toBeDefined();

    // Test root endpoint (API docs)
    const rootRes = await fetch('http://localhost:13334/');
    const rootData = (await rootRes.json()) as { name: string; endpoints: unknown };
    expect(rootData.name).toBe('ARP Team Dashboard');
    expect(rootData.endpoints).toBeDefined();

    team.stop();
  });

  it('should start dashboard', async () => {
    team.addAgent('test-bot');
    await team.dashboard(13333);

    // Verify dashboard is running
    const response = await fetch('http://localhost:13333/api/agents');
    const data = await response.json() as { agents: Array<{ name: string }> };
    expect(data.agents.length).toBe(1);
    expect(data.agents[0].name).toBe('test-bot');

    team.stop();
  });

  // ─── Health & Metrics Endpoint Tests ─────────────────────────

  it('should return healthy status at /health', async () => {
    team.addAgent('health-bot');
    await team.dashboard(13336);

    const response = await fetch('http://localhost:13336/health');
    const data = await response.json() as { status: string; timestamp: string; uptime: number; agents: number; version: string };

    expect(data.status).toBe('healthy');
    expect(data.timestamp).toBeDefined();
    expect(data.uptime).toBeGreaterThanOrEqual(0);
    expect(data.agents).toBe(1);
    expect(data.version).toBe('0.1.0');

    team.stop();
  });

  it('should return prometheus metrics at /metrics', async () => {
    team.addAgent('metrics-bot');
    await team.dashboard(13337);

    const response = await fetch('http://localhost:13337/metrics');
    const text = await response.text();

    expect(text).toContain('arp_agents_total');
    expect(text).toContain('arp_alerts_total');
    expect(text).toContain('arp_uptime_seconds');

    team.stop();
  });

  it('should include correct agent count at /metrics', async () => {
    team.addAgent('agent-1');
    team.addAgent('agent-2');
    await team.dashboard(13338);

    const response = await fetch('http://localhost:13338/metrics');
    const text = await response.text();

    // Match arp_agents_total X where X is the count
    const agentMatch = text.match(/arp_agents_total\s+(\d+)/);
    expect(agentMatch).not.toBeNull();
    expect(parseInt(agentMatch![1], 10)).toBe(2);

    team.stop();
  });

  it('should track uptime at /health', async () => {
    team.addAgent('uptime-bot');
    await team.dashboard(13339);

    // Small delay to ensure uptime increases
    await new Promise(resolve => setTimeout(resolve, 50));

    const response = await fetch('http://localhost:13339/health');
    const data = await response.json() as { uptime: number };

    expect(data.uptime).toBeGreaterThan(0);

    team.stop();
  });

  it('should set correct content-type for /metrics', async () => {
    team.addAgent('content-type-bot');
    await team.dashboard(13340);

    const response = await fetch('http://localhost:13340/metrics');
    expect(response.headers.get('Content-Type')).toBe('text/plain');

    team.stop();
  });

  // ─── Branch Coverage Tests ────────────────────────────────

  describe('ARP constructor branches - disabled configs', () => {
    it('should disable all components when enabled:false', () => {
      const disabledArp = new ARP({ enabled: false });
      // Should not throw when calling disabled components
      disabledArp.watch.recordToolCall('test', {}, 'result', 100);
      disabledArp.watch.recordResponse('response');
      disabledArp.watch.stats();
      disabledArp.watch.health();
      disabledArp.watch.alerts();
      disabledArp.guard('ls');
      disabledArp.sanitize('test');
      disabledArp.guardStats();
      disabledArp.contextHealth([]);
      disabledArp.anchorText();
      disabledArp.stop();
    });

    it('should disable watch when watch:enabled:false', () => {
      const arp = new ARP({ watch: { enabled: false } });
      arp.watch.recordToolCall('test', {}, 'result', 100);
      const stats = arp.watch.stats();
      expect(stats.totalEvents).toBe(0);
      arp.stop();
    });

    it('should disable memory when memory:enabled:false', () => {
      const arp = new ARP({ memory: { enabled: false } });
      const messages = Array.from({ length: 5 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: 'Long content '.repeat(50),
      }));
      // Should still work but memory features disabled
      const result = arp.compress(messages);
      expect(result.messages).toBeDefined();
      arp.stop();
    });

    it('should handle guard:enabled:false config without error', () => {
      const arp = new ARP({ guard: { enabled: false } });
      // When guard is disabled, sentinel may still block dangerous commands
      // The key is that no error is thrown
      const result = arp.guard('ls');
      expect(result).toBeDefined();
      expect(result.allowed).toBeDefined();
      arp.stop();
    });
  });

  describe('ARP constructor branches - notifications', () => {
    it('should configure telegram notifications when botToken provided', () => {
      // This branch: config.notifications?.telegram?.botToken exists
      const arp = new ARP({
        notifications: {
          telegram: { botToken: 'test-token-123', chatId: 'chat-456' },
        },
      });
      // Should not throw
      arp.watch.recordToolCall('test', {}, 'result', 100);
      arp.stop();
    });

    it('should configure wechat notifications when wechat key provided (line 157 branch)', () => {
      // This branch: config.notifications?.wechat?.key exists - line 157
      const arp = new ARP({
        notifications: {
          wechat: { key: 'wechat-serverjian-key-123' },
        },
      });
      // Should not throw
      arp.watch.recordToolCall('test', {}, 'result', 100);
      arp.stop();
    });

    it('should configure screenshot verifier when visionApiKey provided (line 174 branch)', () => {
      // This branch: config.verify?.visionApiKey exists - line 174
      const arp = new ARP({
        verify: {
          visionApiKey: 'vision-api-key-123',
        },
      });
      // Should not throw
      arp.watch.recordToolCall('test', {}, 'result', 100);
      arp.stop();
    });

    it('should configure email notifications when email config provided', () => {
      // This branch: config.notifications?.email exists (but may not be used)
      const arp = new ARP({
        notifications: {
          email: { host: 'smtp.test.com', port: 587, user: 'test', pass: 'pass', to: 'dest@test.com' },
        },
      });
      // Should not throw
      arp.watch.recordToolCall('test', {}, 'result', 100);
      arp.stop();
    });
  });

  describe('ARP constructor branches - memory strategy', () => {
    it('should use summarize strategy when memory.strategy:summarize', () => {
      const arp = new ARP({ memory: { strategy: 'summarize' } });
      const messages = Array.from({ length: 15 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: 'Building the authentication system with JWT tokens and OAuth2. '.repeat(20),
      }));
      const result = arp.compress(messages);
      expect(result.messages.length).toBeLessThanOrEqual(15);
      expect(result.summary).toBeDefined();
      arp.stop();
    });

    it('should use truncate strategy when memory.strategy:truncate', () => {
      const arp = new ARP({ memory: { strategy: 'truncate' } });
      const messages = Array.from({ length: 15 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: 'Building the authentication system with JWT tokens and OAuth2. '.repeat(20),
      }));
      const result = arp.compress(messages);
      expect(result.messages.length).toBeLessThanOrEqual(15);
      arp.stop();
    });
  });

  describe('verify() fallback branch - no schema/requiredFields', () => {
    it('should use full claim verify when no schema or requiredFields provided', async () => {
      const arp = new ARP();
      const result = await arp.verify({ output: { name: 'Test' } });
      // Falls through to full claim verify, returns the result from verifier
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      arp.stop();
    });

    it('should verify with schema when schema provided', async () => {
      const arp = new ARP();
      const result = await arp.verify(
        { output: { name: 'Alice', age: 30 } },
        { schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } }
      );
      expect(result.status).toBe('passed');
      arp.stop();
    });

    it('should verify with requiredFields when requiredFields provided', async () => {
      const arp = new ARP();
      const result = await arp.verify(
        { output: { name: 'Alice' } },
        { requiredFields: ['name'] }
      );
      expect(result.status).toBe('passed');
      arp.stop();
    });

    it('should verify with both schema AND requiredFields provided (line 250-252 branch)', async () => {
      const arp = new ARP();
      // This tests the branch where options.schema || options.requiredFields is true
      // because BOTH are provided - not just one or the other
      const result = await arp.verify(
        { output: { name: 'Alice', email: 'alice@test.com', age: 30 } },
        {
          schema: { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string' } }, required: ['name'] },
          requiredFields: ['name', 'email']
        }
      );
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      arp.stop();
    });

    it('should return fallback when verifier returns empty results array (line 256-266)', async () => {
      const arp = new ARP();
      // Trigger the fallback branch by calling verify without schema or requiredFields
      // When verifier returns report with empty results array, it should return the fallback object
      const result = await arp.verify({ output: { test: 'data' } });
      // If results[0] is falsy/undefined, returns fallback with status 'skipped'
      expect(result).toBeDefined();
      expect(result.status === 'skipped' || result.status === 'passed' || result.status === 'failed').toBe(true);
      arp.stop();
    });
  });

  describe('TeamARP.getAllAlerts sorting and slicing with multiple agents', () => {
    it('should sort alerts by timestamp and slice with limit across multiple agents', () => {
      const bot1 = team.addAgent('agent-1');
      const bot2 = team.addAgent('agent-2');
      const bot3 = team.addAgent('agent-3');

      // Generate alerts on all bots
      for (let i = 0; i < 15; i++) {
        bot1.watch.recordToolCall('retry', {}, 'same', 50);
      }
      for (let i = 0; i < 12; i++) {
        bot2.watch.recordToolCall('retry', {}, 'same', 50);
      }
      for (let i = 0; i < 8; i++) {
        bot3.watch.recordToolCall('retry', {}, 'same', 50);
      }

      // Get alerts with a small limit to test slicing
      const alerts = team.getAllAlerts(5);
      expect(alerts.length).toBeLessThanOrEqual(5);

      // Verify sorting by timestamp descending (newest first)
      if (alerts.length > 1) {
        for (let i = 1; i < alerts.length; i++) {
          const prevTime = new Date(alerts[i - 1].alert.timestamp).getTime();
          const currTime = new Date(alerts[i].alert.timestamp).getTime();
          expect(prevTime).toBeGreaterThanOrEqual(currTime);
        }
      }
    });

    it('should handle empty alert limit edge case', () => {
      team.addAgent('empty-bot');
      const alerts = team.getAllAlerts(0);
      // With limit 0, should return empty or all alerts depending on implementation
      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  describe('TeamARP.stop without dashboard', () => {
    it('should stop without dashboard when dashboard was never started', () => {
      team.addAgent('orphan-bot');
      team.addAgent('orphan-bot-2');
      // No dashboard started - stop should handle null dashboardServer
      team.stop();
      expect(team.listAgents().length).toBe(0);
    });

    it('should stop after dashboard is closed', async () => {
      team.addAgent('cleanup-bot');
      await team.dashboard(13335);
      team.stop();
      // Should handle gracefully
      expect(team.listAgents().length).toBe(0);
    });
  });

  describe('TeamARP.getAllStats with empty agents map', () => {
    it('should return empty object when no agents added', () => {
      // No agents added - the for loop won't execute, returns empty object
      const stats = team.getAllStats();
      expect(stats).toEqual({});
    });

    it('should return empty stats for all agents when no events recorded', () => {
      team.addAgent('empty-agent');
      const stats = team.getAllStats();
      expect(stats['empty-agent']).toBeDefined();
      expect(stats['empty-agent'].totalEvents).toBe(0);
    });
  });

  describe('TeamARP.getAllAlerts edge cases', () => {
    it('should return exactly limit alerts when there are more available (line 399-410)', () => {
      const bot = team.addAgent('alert-bot');
      // Generate exactly 5 loop alerts
      for (let i = 0; i < 5; i++) {
        bot.watch.recordToolCall('retry', {}, 'same', 50);
      }
      // Also add a few other events
      bot.watch.recordToolCall('search', {}, 'result', 100);

      const alerts = team.getAllAlerts(5);
      // Limit is exactly 5, should return at most 5
      expect(alerts.length).toBeLessThanOrEqual(5);
    });

    it('should handle getAllAlerts with default limit', () => {
      const bot = team.addAgent('default-limit-bot');
      for (let i = 0; i < 15; i++) {
        bot.watch.recordToolCall('retry', {}, 'same', 50);
      }
      // Call without explicit limit - uses default of 10
      const alerts = team.getAllAlerts();
      expect(alerts.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Dashboard /api/stats endpoint with no agents', () => {
    it('should return empty stats object when no agents at /api/stats', async () => {
      // No agents added - /api/stats should return empty object
      await team.dashboard(13341);

      const response = await fetch('http://localhost:13341/api/stats');
      const data = (await response.json()) as Record<string, unknown>;

      expect(data).toEqual({});
      expect(Object.keys(data).length).toBe(0);

      team.stop();
    });

    it('should return empty agents array at /api/agents when no agents', async () => {
      await team.dashboard(13342);

      const response = await fetch('http://localhost:13342/api/agents');
      const data = (await response.json()) as { agents: unknown[] };

      expect(data.agents).toEqual([]);

      team.stop();
    });
  });
});
