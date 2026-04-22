# ARP API Documentation

Agent Reliability Platform - Complete API Reference

---

## Table of Contents

- [Overview](#overview)
- [Plugin Architecture](#plugin-architecture)
- [silent-watch: Silent Failure Detection](#silent-watch)
- [permission-sentinel: Security Firewall](#permission-sentinel)
- [cognitive-governor: Memory Management](#cognitive-governor)
- [output-verifier: Output Verification](#output-verifier)
- [agent-stress-tester: Stress Testing](#agent-stress-tester)
- [Environment Variables](#environment-variables)
- [Error Codes](#error-codes)

---

## Overview

ARP (Agent Reliability Platform) is a modular system composed of 5 independent plugins:

| Plugin | Purpose |
|--------|---------|
| **silent-watch** | Real-time monitoring for silent failures |
| **permission-sentinel** | Security firewall and data sanitization |
| **cognitive-governor** | Memory and context management |
| **output-verifier** | Agent output verification |
| **agent-stress-tester** | Stress testing and behavioral analysis |

---

## Plugin Architecture

Each plugin follows a standard pattern:

```
PluginName/
├── src/
│   ├── index.ts        # Public exports
│   ├── config.ts       # Configuration & loadConfig()
│   ├── types.ts        # TypeScript interfaces
│   ├── pluginMain.ts   # Main class
│   └── ...
```

### Common Patterns

- `loadConfig()` - Load configuration from environment variables
- `getDefaultConfig()` - Get default configuration
- All plugins support `enabled: boolean` to toggle functionality

---

## silent-watch

Silent failure detection for AI agents. Detects loops, empty responses, timeouts, and anomalous behavior.

### SilentWatcher Interface

```typescript
import { SilentWatchMonitor, loadConfig } from 'silent-watch';

const config = loadConfig();
const monitor = new SilentWatchMonitor(config);
```

#### Methods

##### recordToolCall(tool, args?, result?, duration?)

Record a tool call event for loop/timeout detection.

```typescript
monitor.recordToolCall('search_database', { query: 'users' }, results, 150);
// Returns: void
```

##### recordResponse(content)

Record an agent response for empty response detection.

```typescript
monitor.recordResponse('Found 42 users matching your query');
// Returns: void
```

##### recordCronTrigger(name, id)

Record a cron job trigger.

```typescript
monitor.recordCronTrigger('daily-report', 'cron-123');
// Returns: void
```

##### registerCronTask(name, id, intervalMs)

Register a cron task for miss detection.

```typescript
monitor.registerCronTask('daily-report', 'cron-123', 86400000);
// Returns: void
```

##### getStats()

Get monitoring statistics.

```typescript
const stats = monitor.getStats();
// Returns: MonitorStats
```

```typescript
interface MonitorStats {
  totalEvents: number;
  totalAlerts: number;
  uptimeSeconds: number;
  lastEventTime?: Date;
  lastAlertTime?: Date;
  alertsByType: {
    loop_detected: number;
    empty_response: number;
    timeout: number;
    cron_missed: number;
    anomaly: number;
  };
}
```

##### getRecentAlerts(limit?)

Get recent alerts.

```typescript
const alerts = monitor.getRecentAlerts(10);
// Returns: Alert[]
```

##### healthCheck()

Perform health check on all detectors and notifiers.

```typescript
const health = monitor.healthCheck();
// Returns: HealthCheckResult
```

```typescript
interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  lastCheck: Date;
  detectors: Record<string, 'active' | 'inactive' | 'error'>;
  notifiers: Record<string, 'active' | 'inactive' | 'error'>;
}
```

##### stop()

Stop the monitor and cleanup resources.

```typescript
monitor.stop();
// Returns: void
```

### Config Interface

```typescript
interface SilentWatchConfig {
  enabled: boolean;
  detectLoops: boolean;
  detectEmptyResponses: boolean;
  detectTimeouts: boolean;
  detectCronMisses: boolean;
  detectAnomalies: boolean;
  detectors: DetectorConfig;
  notifiers: NotifierConfig;
  alertHistoryPath?: string;
  onAlert?: (alert: Alert) => void;
  apiKey?: string;
  server?: { requireAuth?: boolean };
}
```

```typescript
interface DetectorConfig {
  maxConsecutiveCalls?: number;      // Default: 10
  maxConsecutiveEmpty?: number;      // Default: 3
  stepTimeoutMs?: number;            // Default: 60000 (60s)
  contextSnapshotSize?: number;      // Default: 10
}
```

### Detector Interface

Base interface for custom detectors.

```typescript
interface Detector {
  name: string;
  check(events: MonitoringEvent[]): DetectorResult;
  reset(): void;
}

interface DetectorResult {
  triggered: boolean;
  alertType?: 'loop_detected' | 'empty_response' | 'timeout' | 'cron_missed' | 'anomaly';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  message?: string;
  details?: Record<string, unknown>;
  suggestedFix?: string;
}
```

### Alert Types

```typescript
type AlertType = 
  | 'loop_detected'      // Same tool called repeatedly
  | 'empty_response'     // Empty or NO_REPLY responses
  | 'timeout'            // Step exceeded time limit
  | 'cron_missed'        // Scheduled task not fired
  | 'anomaly';           // Behavioral anomaly detected
```

---

## permission-sentinel

Security firewall between agent and system. Blocks dangerous commands, sanitizes sensitive data.

### PermissionSentinel Interface

```typescript
import { PermissionSentinel, loadConfig } from 'permission-sentinel';

const sentinel = new PermissionSentinel(loadConfig());
```

#### Methods

##### checkCommand(command)

Check if a command is safe to execute.

```typescript
const result = sentinel.checkCommand('rm -rf /tmp/test');
// Returns: SecurityResult
```

```typescript
interface SecurityResult {
  actionId: string;
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  allowed: boolean;
  requiresConfirmation: boolean;
  reason: string;
  matchedRule?: string;
  safeAlternative?: string;
  sanitizedCommand?: string;
}
```

##### sanitize(text)

Sanitize sensitive data in text.

```typescript
const result = sentinel.sanitize('Phone: 13812345678, Email: alice@test.com');
// Returns: SanitizationResult
```

```typescript
interface SanitizationResult {
  original: string;
  sanitized: string;        // "Phone: [PHONE_REDACTED], Email: [EMAIL_REDACTED]"
  matches: SensitiveDataMatch[];
  wasModified: boolean;
}

interface SensitiveDataMatch {
  type: 'phone' | 'email' | 'id_card' | 'credit_card' | 'api_key' | 'password' | 'token' | 'ip_address' | 'custom';
  original: string;
  replacement: string;
  position: { start: number; end: number };
}
```

##### getStats()

Get security statistics.

```typescript
const stats = sentinel.getStats();
// Returns: { blocked: number; warned: number; sanitized: number; ... }
```

##### stop()

Stop the sentinel.

```typescript
sentinel.stop();
```

### Config Interface

```typescript
interface PermissionSentinelConfig {
  enabled: boolean;
  rules?: SecurityRule[];
  enableSanitization: boolean;
  enableCommandCheck: boolean;
  enableNetworkCheck: boolean;
  safeCommands?: string[];      // Always allowed: ['ls', 'cat', 'echo', 'pwd', 'date', 'whoami']
  blockedCommands?: string[];   // Always blocked
  customSanitizers?: SanitizerPattern[];
  logPath?: string;
}
```

### SecurityRule Interface

```typescript
interface SecurityRule {
  id: string;
  name: string;
  pattern: string;           // Regex pattern
  riskLevel: RiskLevel;
  description: string;
  action: 'block' | 'warn' | 'confirm';
  safeAlternative?: string;
}
```

### RiskLevel Type

```typescript
type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';
```

---

## cognitive-governor

Memory and context management for long conversations. Handles compression, instruction anchors, and knowledge base.

### CognitiveGovernor Interface

```typescript
import { CognitiveGovernor, loadConfig } from 'cognitive-governor';

const governor = new CognitiveGovernor(loadConfig());
```

#### Methods

##### compressContext(messages)

Compress conversation context to save tokens.

```typescript
const result = governor.compressContext(longMessages);
// Returns: { compressed: ConversationMessage[]; summary: CompressedContext }
```

```typescript
interface CompressedContext {
  id: string;
  originalMessageCount: number;
  summary: string;
  tokensSaved: number;
  timeRange: { start: Date; end: Date };
  preservedTopics: string[];
  timestamp: Date;
}
```

##### addAnchor(instruction, priority?, tags?, expiresAt?)

Add a critical instruction anchor.

```typescript
const anchor = governor.addAnchor('Complete the registration flow', 10, ['auth'], expiresAt);
// Returns: Anchor
```

##### removeAnchor(id)

Remove an anchor by ID.

```typescript
const removed = governor.removeAnchor('anchor-123');
// Returns: boolean
```

##### generateAnchorInjection()

Generate text to inject into prompt with all active anchors.

```typescript
const text = governor.generateAnchorInjection();
// Returns: string (anchors formatted for prompt injection)
```

##### storeKnowledge(problem, solution, tags?)

Store solved problem in knowledge base.

```typescript
governor.storeKnowledge('JWT refresh fails', 'Use refresh token rotation', ['auth']);
// Returns: KnowledgeEntry
```

##### searchKnowledge(query)

Search knowledge base.

```typescript
const results = governor.searchKnowledge({ text: 'JWT refresh', limit: 3 });
// Returns: KnowledgeEntry[]
```

##### getHealth(messages?)

Get context health metrics.

```typescript
const health = governor.getHealth(currentMessages);
// Returns: ContextHealth
```

```typescript
interface ContextHealth {
  totalTokens: number;
  tokenLimit: number;
  usagePercent: number;
  messageCount: number;
  compressedSummaries: number;
  activeAnchors: number;
  knowledgeEntries: number;
  status: 'healthy' | 'warning' | 'critical';
}
```

##### stop()

Stop the governor.

```typescript
governor.stop();
```

### Config Interface

```typescript
interface CognitiveGovernorConfig {
  enabled: boolean;
  tokenLimit: number;              // Default: 8000
  compressionThreshold: number;    // 0-1, compress when exceeded (default: 0.7)
  compressionStrategy: 'smart' | 'summarize' | 'truncate';
  maxAnchors: number;              // Default: 10
  maxKnowledgeEntries: number;    // Default: 100
  persistencePath?: string;
  tokenCounter?: (text: string) => number;
}
```

### Core Types

```typescript
interface ConversationMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp?: Date;
  tokenCount?: number;
  metadata?: Record<string, unknown>;
}

interface Anchor {
  id: string;
  instruction: string;
  priority: number;         // Higher = more important
  createdAt: Date;
  expiresAt?: Date;
  tags?: string[];
}

interface KnowledgeEntry {
  id: string;
  problem: string;
  solution: string;
  tags: string[];
  useCount: number;
  createdAt: Date;
  lastUsedAt?: Date;
  relevanceScore: number;    // 0-1
}
```

---

## output-verifier

Verifies agent outputs against schemas, APIs, screenshots, and E2E tests.

### OutputVerifier Interface

```typescript
import { OutputVerifier, loadConfig } from 'output-verifier';

const verifier = new OutputVerifier(loadConfig());
```

#### Methods

##### verify(claim)

Verify an agent claim.

```typescript
const report = await verifier.verify({
  id: 'claim-1',
  timestamp: new Date(),
  description: 'User data updated',
  output: { userId: 42, name: 'Alice' }
});
// Returns: VerificationReport
```

##### verifyOutput(output, schema?, requiredFields?)

Quick schema verification.

```typescript
const result = await verifier.verifyOutput(
  { userId: 42, name: 'Alice' },
  { type: 'object', properties: { userId: { type: 'number' } } },
  ['userId']
);
// Returns: VerificationResult
```

##### stop()

Stop the verifier.

```typescript
verifier.stop();
```

### Config Interface

```typescript
interface OutputVerifierConfig {
  enabled: boolean;
  strictness: 'lenient' | 'standard' | 'strict';
  verifiers: {
    schema?: SchemaVerifierConfig;
    data?: DataVerifierConfig;
    api?: DataVerifierConfig;
    screenshot?: ScreenshotVerifierConfig;
    e2e?: VerifierConfig;
  };
  notifiers?: NotifierConfig;
  reportPath?: string;
  maxReports?: number;
  onVerification?: (result: VerificationResult) => void;
}
```

### Core Types

```typescript
interface AgentClaim {
  id: string;
  timestamp: Date;
  description: string;
  output?: unknown;
  screenshotPath?: string;
  toolCalls?: ToolCallRecord[];
  metadata?: Record<string, unknown>;
}

interface VerificationResult {
  id: string;
  claimId: string;
  verifierType: 'schema' | 'data' | 'api' | 'screenshot' | 'e2e';
  status: 'passed' | 'failed' | 'partial' | 'skipped' | 'error';
  score: number;           // 0-100
  message: string;
  details: VerificationDetail[];
  timestamp: Date;
  durationMs: number;
  suggestedFix?: string;
  evidence?: VerificationEvidence;
}

interface VerificationReport {
  id: string;
  claim: AgentClaim;
  results: VerificationResult[];
  overallStatus: VerificationStatus;
  overallScore: number;
  timestamp: Date;
  totalDurationMs: number;
  summary: string;
}

type VerificationStatus = 'passed' | 'failed' | 'partial' | 'skipped' | 'error';
```

---

## agent-stress-tester

Stress testing framework for AI agents. Tests for behavioral drift, adversarial prompts, and load handling.

### StressTester Interface

```typescript
import { StressTester, loadConfig } from 'agent-stress-tester';

const tester = new StressTester(loadConfig());
```

#### Methods

##### runTestCase(testCase)

Run a single test case.

```typescript
const result = await tester.runTestCase({
  id: 'test-1',
  name: 'Basic query',
  type: 'normal',
  prompt: 'What is 2+2?',
  expectedBehavior: '4'
});
// Returns: TestResult
```

##### runStressTest(testCases)

Run multiple test cases with concurrency control.

```typescript
const report = await tester.runStressTest(testCases);
// Returns: StressTestReport
```

##### registerAnalyzer(callback)

Register a callback for test result analysis.

```typescript
tester.registerAnalyzer((result) => {
  console.log(`Test ${result.testCaseId}: ${result.passed ? 'PASSED' : 'FAILED'}`);
});
```

##### registerDetector(callback)

Register a callback for drift/failure detection.

```typescript
tester.registerDetector((result) => {
  if (result.driftScore && result.driftScore > 0.5) {
    console.warn('Drift detected!');
  }
});
```

##### on(event, callback) / off(event, callback)

Event listeners for test lifecycle.

```typescript
tester.on('test:start', (testCase) => console.log('Started:', testCase.name));
tester.on('test:end', (result) => console.log('Ended:', result.testCaseId));
tester.on('stress:test:start', (data) => console.log('Batch started:', data.total));
tester.on('stress:test:end', (report) => console.log('Batch ended:', report.summary));
```

##### getResults()

Get all test results.

```typescript
const results = tester.getResults();
// Returns: TestResult[]
```

##### getConfig()

Get current configuration.

```typescript
const config = tester.getConfig();
// Returns: StressTestConfig
```

### Config Interface

```typescript
interface StressTestConfig {
  enabled: boolean;
  targetAgent: string;
  testTimeout: number;       // Default: 30000ms
  maxConcurrent: number;    // Default: 5
  testSuites: string[];     // ['adversarial', 'drift', 'load', 'normal']
  driftThreshold: number;   // Default: 0.85
  loadProfiles: LoadProfile[];
}
```

### Core Types

```typescript
interface TestCase {
  id: string;
  name: string;
  type: 'normal' | 'adversarial' | 'load' | 'drift';
  prompt: string;
  expectedBehavior?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
}

interface TestResult {
  testCaseId: string;
  passed: boolean;
  latency: number;
  response?: string;
  error?: string;
  driftScore?: number;
  timestamp: number;
}

interface StressTestReport {
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

interface PerformanceMetrics {
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

type AdversarialPattern = 
  | 'prompt_injection'
  | 'jailbreak'
  | 'ambiguity'
  | 'contradiction'
  | 'edge_case'
  | 'privilege_escalation'
  | 'roleplay'
  | 'social_engineering';

interface LoadProfile {
  name: string;
  type: 'spike' | 'gradual' | 'random' | 'constant';
  duration: number;
  qps: number;
  burst?: number;
}
```

---

## Environment Variables

### Plugin Feature Flags

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SILENT_WATCH_ENABLED` | boolean | false | Enable silent-watch plugin |
| `COGNITIVE_GOVERNOR_ENABLED` | boolean | false | Enable cognitive-governor plugin |
| `PERMISSION_SENTINEL_ENABLED` | boolean | false | Enable permission-sentinel plugin |
| `OUTPUT_VERIFIER_ENABLED` | boolean | false | Enable output-verifier plugin |
| `STRESS_TESTER_ENABLED` | boolean | false | Enable agent-stress-tester plugin |

### SilentWatch Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SILENT_WATCH_MAX_CONSECUTIVE_CALLS` | number | 10 | Max same-tool calls before alert |
| `SILENT_WATCH_MAX_CONSECUTIVE_EMPTY` | number | 3 | Max empty responses before alert |
| `SILENT_WATCH_STEP_TIMEOUT_MS` | number | 60000 | Timeout per step in ms |
| `SILENT_WATCH_CONTEXT_SIZE` | number | 10 | Events in alert context |
| `SILENT_WATCH_API_KEY` | string | - | API authentication key |
| `SILENT_WATCH_REQUIRE_AUTH` | boolean | false | Require API authentication |

### Notification Channels

| Variable | Description |
|----------|-------------|
| `SERVER_CHAN_KEY` | Server酱 SendKey (uses SERVER_CHAN_KEY, not WECHAT_KEY) |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `TELEGRAM_CHAT_ID` | Telegram chat ID |
| `SLACK_WEBHOOK` | Slack incoming webhook URL |
| `FEISHU_WEBHOOK` | 飞书 WebHook URL |

### Email/SMTP

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | smtp.gmail.com | SMTP server |
| `SMTP_PORT` | 587 | SMTP port |
| `SMTP_USER` | - | SMTP username |
| `SMTP_PASS` | - | SMTP password/app password |
| `TO_EMAIL` | - | Destination email |
| `FROM_EMAIL` | - | Sender email |

### AI/Vision API

| Variable | Description |
|----------|-------------|
| `VISION_API_KEY` | AI vision API key for screenshot verification |

### Cognitive Governor

| Variable | Default | Description |
|----------|---------|-------------|
| `COGNITIVE_GOVERNOR_TOKEN_LIMIT` | 8000 | Context token limit |
| `COGNITIVE_GOVERNOR_THRESHOLD` | 0.7 | Compression threshold (0-1) |
| `COGNITIVE_GOVERNOR_STRATEGY` | smart | Strategy: smart/summarize/truncate |

### Output Verifier

| Variable | Description |
|----------|-------------|
| `OUTPUT_VERIFIER_STRICTNESS` | standard | leniet/standard/strict |
| `OUTPUT_VERIFIER_API_URL` | - | API endpoint for verification |
| `OUTPUT_VERIFIER_API_KEY` | - | API authentication key |
| `OUTPUT_VERIFIER_VISION_API_KEY` | - | Vision API for screenshot verification |
| `OUTPUT_VERIFIER_REPORT_PATH` | ./verification-reports.json | Report storage path |

### Agent Stress Tester

| Variable | Default | Description |
|----------|---------|-------------|
| `TARGET_AGENT` | opencli | Target agent identifier |
| `TEST_TIMEOUT` | 30000 | Per-test timeout in ms |
| `MAX_CONCURRENT` | 5 | Max concurrent tests |
| `TEST_SUITES` | adversarial,drift,load,normal | Active test suites |
| `DRIFT_THRESHOLD` | 0.85 | Drift detection threshold |
| `LOAD_PROFILES` | JSON | Load test profiles |

### Runtime

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | development | development/production/test |

---

## Error Codes

### SilentWatch Errors (SW-1xxx)

| Code | Error | Description |
|------|-------|-------------|
| SW-1001 | DETECTOR_INIT_FAILED | Failed to initialize detector |
| SW-1002 | NOTIFIER_SEND_FAILED | Failed to send notification |
| SW-1003 | EVENT_BUFFER_FULL | Event buffer overflow |
| SW-1004 | INVALID_CONFIG | Invalid configuration |
| SW-1005 | ALERT_HANDLER_ERROR | Alert callback threw error |

### Permission Sentinel Errors (PS-2xxx)

| Code | Error | Description |
|------|-------|-------------|
| PS-2001 | RULE_PARSE_ERROR | Failed to parse security rule regex |
| PS-2002 | SANITIZE_FAILED | Sanitization operation failed |
| PS-2003 | CHECK_TIMEOUT | Security check timed out |
| PS-2004 | INVALID_RISK_LEVEL | Unknown risk level in rule |

### Cognitive Governor Errors (CG-3xxx)

| Code | Error | Description |
|------|-------|-------------|
| CG-3001 | COMPRESSION_FAILED | Context compression failed |
| CG-3002 | TOKEN_COUNT_ERROR | Token counting failed |
| CG-3003 | PERSISTENCE_ERROR | Failed to save/load data |
| CG-3004 | ANCHOR_EXPIRED | Anchor has expired |
| CG-3005 | KNOWLEDGE_FULL | Knowledge base at capacity |

### Output Verifier Errors (OV-4xxx)

| Code | Error | Description |
|------|-------|-------------|
| OV-4001 | SCHEMA_VALIDATION_FAILED | JSON Schema validation error |
| OV-4002 | API_VERIFY_FAILED | API verification request failed |
| OV-4003 | SCREENSHOT_ANALYSIS_FAILED | Vision API error |
| OV-4004 | E2E_TEST_FAILED | End-to-end test assertion failed |
| OV-4005 | VERIFIER_TIMEOUT | Verification timed out |

### Agent Stress Tester Errors (ST-5xxx)

| Code | Error | Description |
|------|-------|-------------|
| ST-5001 | TEST_TIMEOUT | Individual test timed out |
| ST-5002 | AGENT_CALL_FAILED | Failed to call agent endpoint |
| ST-5003 | DRIFT_DETECTED | Behavioral drift exceeded threshold |
| ST-5004 | LOAD_GENERATION_FAILED | Failed to generate load profile |
| ST-5005 | INVALID_TEST_CASE | Test case validation failed |

---

---

## ARP Main Class

Unified API combining all plugins into a single `ARP` class for single-agent use.

### ARP Interface

```typescript
import { ARP } from 'arp';

const arp = new ARP({
  watch: { maxConsecutiveCalls: 15 },
  memory: { tokenLimit: 10000 },
  notifications: { wechat: { key: 'YOUR_KEY' } }
});
```

#### Methods

##### watch

Access SilentWatch monitoring methods.

```typescript
arp.watch.recordToolCall('search', { q: 'test' }, results, 120);
arp.watch.recordResponse('Found 42 results');
arp.watch.recordCron('daily-report', 'cron-123');
arp.watch.registerCron('daily-report', 'cron-123', 86400000);
const stats = arp.watch.stats();
const alerts = arp.watch.alerts(10);
const health = arp.watch.health();
```

##### verify(claim, options?)

Verify an agent output claim.

```typescript
const result = await arp.verify(
  { output: { userId: 42 } },
  { schema: { type: 'object' }, requiredFields: ['userId'] }
);
// Returns: VerificationResult
```

##### compress(messages)

Compress conversation context to save tokens.

```typescript
const { messages, summary } = arp.compress(longConversation);
// Returns: { messages: ConversationMessage[]; summary: CompressedContext }
```

##### anchor(instruction, priority?, tags?, expiresAt?)

Add a critical instruction anchor.

```typescript
const anchor = arp.anchor('Complete registration', 10, ['auth'], expiresAt);
// Returns: Anchor
```

##### unanchor(id)

Remove an anchor by ID.

```typescript
const removed = arp.unanchor('anchor-123');
// Returns: boolean
```

##### anchorText()

Generate text to inject into prompt with all active anchors.

```typescript
const text = arp.anchorText();
// Returns: string
```

##### learn(problem, solution, tags?)

Store solved problem in knowledge base.

```typescript
arp.learn('JWT refresh fails', 'Use refresh token rotation', ['auth']);
// Returns: void
```

##### recall(text, limit?)

Search knowledge base.

```typescript
const results = arp.recall('JWT refresh', 3);
// Returns: KnowledgeEntry[]
```

##### contextHealth(messages?)

Get context health metrics.

```typescript
const health = arp.contextHealth(currentMessages);
// Returns: ContextHealth
```

##### guard(command)

Check if a command is safe to execute.

```typescript
const result = arp.guard('rm -rf /');
// Returns: SecurityResult
```

##### sanitize(text)

Sanitize sensitive data in text.

```typescript
const result = arp.sanitize('Phone: 13812345678, Email: alice@test.com');
// Returns: SanitizationResult
```

##### guardStats()

Get security statistics.

```typescript
const stats = arp.guardStats();
// Returns: SentinelStats
```

##### stop()

Stop all components.

```typescript
arp.stop();
// Returns: void
```

---

## TeamARP

Multi-agent management with shared dashboard.

### TeamARP Interface

```typescript
import { TeamARP } from 'arp';

const team = new TeamARP();
```

#### Methods

##### addAgent(name, config?)

Add an agent to the team.

```typescript
const arp = team.addAgent('frontend-bot', {
  watch: { maxConsecutiveCalls: 15 }
});
// Returns: ARP
```

##### getAgent(name)

Get an agent by name.

```typescript
const arp = team.getAgent('frontend-bot');
// Returns: ARP | undefined
```

##### removeAgent(name)

Remove an agent.

```typescript
const removed = team.removeAgent('frontend-bot');
// Returns: boolean
```

##### listAgents()

List all agents.

```typescript
const agents = team.listAgents();
// Returns: AgentStatus[]
```

##### getAllStats()

Get stats for all agents.

```typescript
const stats = team.getAllStats();
// Returns: Record<string, MonitorStats>
```

##### getAllAlerts(limit?)

Get all alerts across all agents.

```typescript
const alerts = team.getAllAlerts(20);
// Returns: Array<{ agent: string; alert: Alert }>
```

##### dashboard(port?)

Start a web dashboard (http://localhost:port).

```typescript
await team.dashboard(3000);
// Returns: Promise<void>
```

##### stop()

Stop all agents and dashboard.

```typescript
team.stop();
// Returns: void
```

### Dashboard HTTP Endpoints

When `team.dashboard(port)` is called, the following HTTP endpoints are available:

#### `GET /health` - Health Check

Returns basic health status.

```bash
curl http://localhost:3000/health
```

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600.5,
  "agents": 2,
  "version": "0.1.0"
}
```

#### `GET /metrics` - Prometheus Metrics

Returns metrics in Prometheus text format.

```bash
curl http://localhost:3000/metrics
```

```
# HELP arp_agents_total Number of agents
# TYPE arp_agents_total gauge
arp_agents_total 2
# HELP arp_alerts_total Total alerts across all agents
# TYPE arp_alerts_total counter
arp_alerts_total 5
# HELP arp_uptime_seconds TeamARP uptime in seconds
# TYPE arp_uptime_seconds gauge
arp_uptime_seconds 3600.5
```

#### `GET /api/agents` - List Agents

Returns all agents with their stats and health.

```bash
curl http://localhost:3000/api/agents
```

```json
{
  "agents": [
    {
      "name": "agent-1",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "stats": { ... },
      "health": { ... }
    }
  ]
}
```

#### `GET /api/alerts?limit=N` - Get Alerts

Returns all alerts across agents (default limit: 20).

```bash
curl http://localhost:3000/api/alerts?limit=10
```

```json
{
  "alerts": [
    { "agent": "agent-1", "alert": { "type": "loop_detected", ... } }
  ]
}
```

#### `GET /api/stats` - Get All Stats

Returns aggregated stats for all agents.

```bash
curl http://localhost:3000/api/stats
```

```json
{
  "totalAgents": 2,
  "totalEvents": 100,
  "totalAlerts": 5,
  ...
}
```

### Dashboard Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DASHBOARD_ALLOWED_ORIGIN` | `localhost` | CORS allowed origin. Set to specific domain in production (e.g., `https://arp.example.com`) |

---

## Core Types

### AgentStatus

```typescript
interface AgentStatus {
  name: string;
  arp: ARP;
  createdAt: Date;
  lastActivity?: Date;
}
```

### SecurityAction

```typescript
interface SecurityAction {
  id: string;
  type: 'command' | 'file_operation' | 'network' | 'data_access' | 'api_call';
  command: string;
  args?: Record<string, unknown>;
  timestamp: Date;
  context?: string;
}
```

---

## Usage Examples

### Quick Start with ARP Main Class

```typescript
import { ARP, TeamARP } from 'arp';

// Single agent
const arp = new ARP({
  notifications: { wechat: { key: 'YOUR_KEY' } },
  watch: { maxConsecutiveCalls: 15 },
  memory: { tokenLimit: 10000 }
});

arp.watch.recordToolCall('search', { q: 'test' }, results, 120);
const safe = arp.guard('rm -rf /');
const { messages } = arp.compress(longConversation);

await arp.verify({ output: { userId: 42 } }, { requiredFields: ['userId'] });

arp.stop();

// Multi-agent team
const team = new TeamARP();
team.addAgent('bot-1', { guard: { safeCommands: ['ls'] } });
team.addAgent('bot-2', { watch: { maxConsecutiveCalls: 20 } });
await team.dashboard(3000);
```

### Using Plugins Standalone

```typescript
// SilentWatch standalone
import { SilentWatchMonitor } from 'silent-watch';
const monitor = new SilentWatchMonitor({ enabled: true });
monitor.recordToolCall('tool', {}, null, 50000);

// Permission Sentinel standalone
import { PermissionSentinel } from 'permission-sentinel';
const guard = new PermissionSentinel();
const result = guard.checkCommand('sudo rm -rf /');

// Cognitive Governor standalone
import { CognitiveGovernor } from 'cognitive-governor';
const gov = new CognitiveGovernor({ tokenLimit: 8000 });
gov.compressContext(messages);

// Output Verifier standalone
import { OutputVerifier } from 'output-verifier';
const verifier = new OutputVerifier();
await verifier.verifyOutput({ id: 1 }, { requiredFields: ['id'] });

// Stress Tester standalone
import { StressTester } from 'agent-stress-tester';
const tester = new StressTester();
const report = await tester.runStressTest(testCases);
```
