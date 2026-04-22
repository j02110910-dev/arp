/**
 * ARP - Agent Reliability Platform
 * One package. All-in-one. npm install arp
 *
 * @example
 * import { ARP } from 'arp';
 *
 * const arp = new ARP({ wechat: { key: 'xxx' } });
 *
 * // 监控 Agent 执行过程
 * arp.watch.recordToolCall('search', {}, results, 120);
 * arp.watch.recordResponse('Found results');
 *
 * // 验证 Agent 输出
 * const result = await arp.verify({ output: { userId: 42 } }, {
 *   schema: { type: 'object', required: ['userId'] }
 * });
 *
 * // 管理上下文
 * arp.compress(messages);  // 压缩长对话
 * arp.anchor('完成注册流程', 10);  // 关键指令锚点
 *
 * // 安全检查
 * const check = arp.guard('rm -rf /');  // → { blocked: true }
 * const safe = arp.sanitize('Phone: 13812345678');  // → 脱敏后
 */

// ─── Core Types ────────────────────────────────────────────

export interface ARPConfig {
  /** Enable/disable entire platform */
  enabled?: boolean;

  // SilentWatch settings
  watch?: {
    enabled?: boolean;
    maxConsecutiveCalls?: number;
    maxConsecutiveEmpty?: number;
    stepTimeoutMs?: number;
  };

  // Output Verifier settings
  verify?: {
    enabled?: boolean;
    visionApiKey?: string;  // For screenshot verification
  };

  // Cognitive Governor settings
  memory?: {
    enabled?: boolean;
    tokenLimit?: number;
    compressionThreshold?: number;
    strategy?: 'smart' | 'summarize' | 'truncate';
  };

  // Permission Sentinel settings
  guard?: {
    enabled?: boolean;
    safeCommands?: string[];
    blockedCommands?: string[];
  };

  // Notification settings
  notifications?: {
    wechat?: { key?: string };
    telegram?: { botToken?: string; chatId?: string };
    email?: { host?: string; port?: number; user?: string; pass?: string; to?: string };
  };

  /** Alert history file path */
  alertHistoryPath?: string;
  /** Knowledge/persistence file path */
  dataPath?: string;

  // Team features (multi-agent + dashboard + integrations)
  team?: {
    /** Unique name for this agent (for multi-agent tracking) */
    agentName?: string;
    /** Slack webhook URL */
    slackWebhook?: string;
    /** 飞书 webhook URL */
    feishuWebhook?: string;
    /** Dashboard port (0 = disabled) */
    dashboardPort?: number;
  };
}

// ─── Re-export sub-plugin types ────────────────────────────

export type {
  MonitoringEvent,
  Alert,
  AlertType,
} from '../plugins/silent-watch/src/config';

export type {
  AgentClaim,
  VerificationResult,
  VerificationReport,
} from '../plugins/output-verifier/src/types';

export type {
  ConversationMessage,
  CompressedContext,
  Anchor,
  KnowledgeEntry,
  ContextHealth,
} from '../plugins/cognitive-governor/src/types';

export type {
  SecurityAction,
  SecurityResult,
  SanitizationResult,
  RiskLevel,
} from '../plugins/permission-sentinel/src/types';

// Note: OpenClawMonitor types are optional - gracefully skip if unavailable
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _openclawTypes: any = null;
void _openclawTypes;

// ─── Imports ───────────────────────────────────────────────

import { SilentWatchMonitor } from '../plugins/silent-watch/src';
import { OutputVerifier } from '../plugins/output-verifier/src';
import { CognitiveGovernor } from '../plugins/cognitive-governor/src';
import { PermissionSentinel } from '../plugins/permission-sentinel/src';
import { createLogger } from './utils/logger';
const logger = createLogger('arp');

import type { AgentClaim, VerificationResult } from '../plugins/output-verifier/src/types';
import type { ConversationMessage, CompressedContext, Anchor } from '../plugins/cognitive-governor/src/types';
import type { SecurityResult, SanitizationResult } from '../plugins/permission-sentinel/src/types';

export class ARP {
  private watchMonitor: SilentWatchMonitor;
  private verifier: OutputVerifier;
  private governor: CognitiveGovernor;
  private sentinel: PermissionSentinel;

  constructor(config: ARPConfig = {}) {
    const enabled = config.enabled !== false;

    // Initialize SilentWatch
    this.watchMonitor = new SilentWatchMonitor({
      enabled: enabled && (config.watch?.enabled !== false),
      detectLoops: true,
      detectEmptyResponses: true,
      detectTimeouts: true,
      detectCronMisses: true,
      detectAnomalies: true,
      detectors: {
        maxConsecutiveCalls: config.watch?.maxConsecutiveCalls || 10,
        maxConsecutiveEmpty: config.watch?.maxConsecutiveEmpty || 3,
        stepTimeoutMs: config.watch?.stepTimeoutMs || 60000,
        contextSnapshotSize: 10,
      },
      notifiers: {
        console: { enabled: true, level: 'info' as const },
        ...(config.notifications?.wechat?.key ? {
          wechat: { enabled: true, server酱Key: config.notifications.wechat.key },
        } : {}),
        ...(config.notifications?.telegram?.botToken ? {
          telegram: { enabled: true, botToken: config.notifications.telegram.botToken, chatId: config.notifications.telegram.chatId! },
        } : {}),
      },
      alertHistoryPath: config.alertHistoryPath,
    });

    // Initialize Output Verifier
    this.verifier = new OutputVerifier({
      enabled: enabled && (config.verify?.enabled !== false),
      strictness: 'standard' as const,
      verifiers: {
        schema: { enabled: true },
        api: { enabled: true },
        screenshot: config.verify?.visionApiKey
          ? { enabled: true, apiKey: config.verify.visionApiKey }
          : { enabled: false },
        e2e: { enabled: true },
      },
    });

    // Initialize Cognitive Governor
    this.governor = new CognitiveGovernor({
      enabled: enabled && (config.memory?.enabled !== false),
      tokenLimit: config.memory?.tokenLimit || 8000,
      compressionThreshold: config.memory?.compressionThreshold || 0.7,
      compressionStrategy: config.memory?.strategy || 'smart' as const,
      maxAnchors: 10,
      maxKnowledgeEntries: 100,
      persistencePath: config.dataPath,
    });

    // Initialize Permission Sentinel
    this.sentinel = new PermissionSentinel({
      enabled: enabled && (config.guard?.enabled !== false),
      enableSanitization: true,
      enableCommandCheck: true,
      enableNetworkCheck: true,
      safeCommands: config.guard?.safeCommands || ['ls', 'cat', 'echo', 'pwd'],
      blockedCommands: config.guard?.blockedCommands,
    });
  }

  // ─── SilentWatch: 监控 ─────────────────────────────────

  /** Record a tool call */
  watch = {
    /** Record a tool call event */
    recordToolCall: (tool: string, args?: Record<string, unknown>, result?: unknown, duration?: number) =>
      this.watchMonitor.recordToolCall(tool, args, result, duration),

    /** Record a response */
    recordResponse: (content: string) =>
      this.watchMonitor.recordResponse(content),

    /** Record cron trigger */
    recordCron: (name: string, id: string) =>
      this.watchMonitor.recordCronTrigger(name, id),

    /** Register a cron task for monitoring */
    registerCron: (name: string, id: string, intervalMs: number) =>
      this.watchMonitor.registerCronTask(name, id, intervalMs),

    /** Get monitoring stats */
    stats: () => this.watchMonitor.getStats(),

    /** Get recent alerts */
    alerts: (limit = 10) => this.watchMonitor.getRecentAlerts(limit),

    /** Health check */
    health: () => this.watchMonitor.healthCheck(),
  };

  // ─── Output Verifier: 验证 ─────────────────────────────

  /** Verify an agent claim */
  async verify(
    claim: Partial<AgentClaim> & { output?: unknown },
    options?: { schema?: Record<string, unknown>; requiredFields?: string[] }
  ): Promise<VerificationResult> {
    const fullClaim: AgentClaim = {
      id: claim.id || `claim-${Date.now()}`,
      timestamp: claim.timestamp || new Date(),
      description: claim.description || 'Quick verification',
      output: claim.output,
      toolCalls: claim.toolCalls,
      screenshotPath: claim.screenshotPath,
    };

    // Quick verify with schema
    if (options?.schema || options?.requiredFields) {
      return this.verifier.verifyOutput(claim.output, options.schema, options.requiredFields);
    }

    // Full claim verify
    const report = await this.verifier.verify(fullClaim);
    return report.results[0] || {
      id: 'no-result',
      claimId: fullClaim.id,
      verifierType: 'schema',
      status: 'skipped' as const,
      score: 100,
      message: 'No verifiers ran',
      details: [],
      timestamp: new Date(),
      durationMs: 0,
    };
  }

  // ─── Cognitive Governor: 记忆 ──────────────────────────

  /** Compress conversation context */
  compress(messages: ConversationMessage[]): {
    messages: ConversationMessage[];
    summary: CompressedContext;
  } {
    const result = this.governor.compressContext(messages);
    return { messages: result.compressed, summary: result.summary };
  }

  /** Add a critical instruction anchor */
  anchor(instruction: string, priority = 1, tags?: string[], expiresAt?: Date): Anchor {
    return this.governor.addAnchor(instruction, priority, tags, expiresAt);
  }

  /** Remove an anchor */
  unanchor(id: string): boolean {
    return this.governor.removeAnchor(id);
  }

  /** Get anchor injection text for prompt */
  anchorText(): string {
    return this.governor.generateAnchorInjection();
  }

  /** Store knowledge */
  learn(problem: string, solution: string, tags?: string[]): void {
    this.governor.storeKnowledge(problem, solution, tags);
  }

  /** Search knowledge */
  recall(text: string, limit = 3) {
    return this.governor.searchKnowledge({ text, limit });
  }

  /** Get context health */
  contextHealth(messages?: ConversationMessage[]) {
    return this.governor.getHealth(messages);
  }

  // ─── Permission Sentinel: 安全 ─────────────────────────

  /** Check if a command is safe */
  guard(command: string): SecurityResult {
    return this.sentinel.checkCommand(command);
  }

  /** Sanitize sensitive data */
  sanitize(text: string): SanitizationResult {
    return this.sentinel.sanitize(text);
  }

  /** Get security stats */
  guardStats() {
    return this.sentinel.getStats();
  }

  // ─── Lifecycle ─────────────────────────────────────────

  /** Stop all components */
  stop(): void {
    this.watchMonitor.stop();
    this.verifier.stop();
    this.governor.stop();
    this.sentinel.stop();
  }
}

// ─── TeamARP: Multi-Agent Manager ────────────────────────

export interface AgentStatus {
  name: string;
  arp: ARP;
  createdAt: Date;
  lastActivity?: Date;
}

/**
 * TeamARP - Manage multiple agents with a single dashboard
 *
 * @example
 * const team = new TeamARP();
 * team.addAgent('frontend-bot', { watch: { maxConsecutiveCalls: 15 } });
 * team.addAgent('backend-bot', { watch: { maxConsecutiveCalls: 20 } });
 * team.dashboard(3000);  // http://localhost:3000
 */
export class TeamARP {
  private agents: Map<string, AgentStatus> = new Map();
  private dashboardServer: ReturnType<typeof import('http').createServer> | null = null;
  readonly createdAt = new Date();

  /** Add an agent to the team */
  addAgent(name: string, config?: ARPConfig): ARP {
    const arp = new ARP({ ...config, team: { ...config?.team, agentName: name } });
    this.agents.set(name, { name, arp, createdAt: new Date() });
    return arp;
  }

  /** Get an agent by name */
  getAgent(name: string): ARP | undefined {
    return this.agents.get(name)?.arp;
  }

  /** Remove an agent */
  removeAgent(name: string): boolean {
    const agent = this.agents.get(name);
    if (agent) {
      agent.arp.stop();
      this.agents.delete(name);
      return true;
    }
    return false;
  }

  /** List all agents */
  listAgents(): AgentStatus[] {
    return Array.from(this.agents.values());
  }

  /** Get stats for all agents */
  getAllStats(): Record<string, ReturnType<ARP['watch']['stats']>> {
    const stats: Record<string, ReturnType<ARP['watch']['stats']>> = {};
    for (const [name, agent] of this.agents) {
      stats[name] = agent.arp.watch.stats();
    }
    return stats;
  }

  /** Get all alerts across all agents */
  getAllAlerts(limit = 10): Array<{ agent: string; alert: ReturnType<ARP['watch']['alerts']>[0] }> {
    const allAlerts: Array<{ agent: string; alert: ReturnType<ARP['watch']['alerts']>[0] }> = [];
    for (const [name, agent] of this.agents) {
      for (const alert of agent.arp.watch.alerts(limit)) {
        allAlerts.push({ agent: name, alert });
      }
    }
    allAlerts.sort((a, b) =>
      new Date(b.alert.timestamp).getTime() - new Date(a.alert.timestamp).getTime()
    );
    return allAlerts.slice(0, limit);
  }

  /** Start a web dashboard */
  async dashboard(port = 3000): Promise<void> {
    const http = await import('http');

    // Graceful shutdown handler
    const shutdown = (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`);
      this.stop();
      process.exit(0);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    this.dashboardServer = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      const allowedOrigin = process.env.DASHBOARD_ALLOWED_ORIGIN || 'localhost';
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      const url = new URL(req.url || '/', `http://localhost:${port}`);

      if (url.pathname === '/api/agents') {
        const agents = this.listAgents().map(a => ({
          name: a.name,
          createdAt: a.createdAt,
          stats: a.arp.watch.stats(),
          health: a.arp.watch.health(),
        }));
        res.end(JSON.stringify({ agents }));
        return;
      }

      if (url.pathname === '/api/alerts') {
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 1000);
        res.end(JSON.stringify({ alerts: this.getAllAlerts(limit) }));
        return;
      }

      if (url.pathname === '/api/stats') {
        res.end(JSON.stringify(this.getAllStats()));
        return;
      }

      if (url.pathname === '/health') {
        const uptimeSeconds = (Date.now() - this.createdAt.getTime()) / 1000;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: uptimeSeconds,
          agents: this.agents.size,
          version: '0.1.0',
        }));
        return;
      }

      if (url.pathname === '/metrics') {
        const uptimeSeconds = (Date.now() - this.createdAt.getTime()) / 1000;
        const allAlerts = this.getAllAlerts(1000);
        res.setHeader('Content-Type', 'text/plain');
        res.end(`# HELP arp_agents_total Number of agents
# TYPE arp_agents_total gauge
arp_agents_total ${this.agents.size}
# HELP arp_alerts_total Total alerts across all agents
# TYPE arp_alerts_total counter
arp_alerts_total ${allAlerts.length}
# HELP arp_uptime_seconds TeamARP uptime in seconds
# TYPE arp_uptime_seconds gauge
arp_uptime_seconds ${uptimeSeconds.toFixed(1)}
`);
        return;
      }

      // Default: API docs
      res.end(JSON.stringify({
        name: 'ARP Team Dashboard',
        endpoints: {
          'GET /api/agents': 'List all agents with stats',
          'GET /api/alerts?limit=N': 'Get all alerts across agents',
          'GET /api/stats': 'Get stats for all agents',
          'GET /health': 'Health check endpoint',
          'GET /metrics': 'Prometheus metrics endpoint',
        },
      }));
    });

    this.dashboardServer.listen(port, () => {
      logger.info('Dashboard server started', { port, endpoint: 'http://localhost:' + port });
    });
  }

  /** Stop all agents and dashboard */
  stop(): void {
    for (const agent of this.agents.values()) {
      agent.arp.stop();
    }
    this.agents.clear();
    if (this.dashboardServer) {
      this.dashboardServer.close();
      this.dashboardServer = null;
    }
  }
}
