# ARP Architecture Document

## Table of Contents
1. [System Overview](#system-overview)
2. [ASCII Architecture Diagram](#ascii-architecture-diagram)
3. [Plugin Lifecycle](#plugin-lifecycle)
4. [Data Flow](#data-flow)
5. [Configuration Loading Order](#configuration-loading-order)
6. [Error Handling Mechanism](#error-handling-mechanism)

---

## System Overview

ARP (Agent Reliability Platform) is a monorepo npm package (`arp`) that combines 5 independent plugins under one unified API. Each plugin addresses a specific reliability concern for AI agents:

| Plugin | Package | Responsibility |
|--------|---------|----------------|
| SilentWatch | `silent-watch` | Real-time monitoring: loop detection, timeout detection, anomaly detection |
| Output Verifier | `output-verifier` | Verifies agent output correctness: schema validation, API checks |
| Cognitive Governor | `@arp/cognitive-governor` | Memory management: context compression, instruction anchors, knowledge base |
| Permission Sentinel | `@arp/permission-sentinel` | Security firewall: dangerous command blocking, sensitive data sanitization |
| Agent Stress Tester | `@arp/agent-stress-tester` | Adversarial testing: drift detection, load testing, prompt injection tests |

The root `src/index.ts` re-exports all plugins and provides a unified `ARP` class facade.

---

## ASCII Architecture Diagram

```
                        ┌─────────────────────────────────────────────────────┐
                        │                    User Code                         │
                        │                                                     │
                        │  const arp = new ARP({ ... });                       │
                        │  arp.watch.recordToolCall(...);                       │
                        │  await arp.verify(...);                              │
                        │  arp.guard('rm -rf /');                              │
                        └───────────────────────┬─────────────────────────────┘
                                                │ imports
                    ┌───────────────────────────┴───────────────────────────┐
                    │              ARP (src/index.ts)                       │
                    │                    Unified Facade                     │
                    └───────┬─────────────┬─────────────┬────────────┬───────┘
                            │             │             │            │
              ┌─────────────▼──┐  ┌───────▼──────┐  ┌──▼─────────┐  ┌▼──────────────┐
              │  SilentWatch   │  │Output Verifier│  │ Cognitive  │  │  Permission   │
              │   Monitor       │  │               │  │  Governor  │  │   Sentinel    │
              │                 │  │               │  │            │  │               │
              │  ┌───────────┐  │  │  ┌─────────┐  │  │ ┌───────┐ │  │ ┌───────────┐ │
              │  │  Loop     │  │  │  │ Schema  │  │  │ │Context│ │  │ │  Command  │ │
              │  │  Detector │  │  │  │ Verifier│  │  │ │Compres│ │  │ │  Checker  │ │
              │  └───────────┘  │  │  └─────────┘  │  │ │sion   │ │  │ └───────────┘ │
              │  ┌───────────┐  │  │  ┌─────────┐  │  │ └───────┘ │  │ ┌───────────┐ │
              │  │  Timeout  │  │  │  │  API    │  │  │ ┌───────┐ │  │ │  Data     │ │
              │  │  Detector │  │  │  │ Verifier│  │  │ │Anchor │ │  │ │Sanitizer │ │
              │  └───────────┘  │  │  └─────────┘  │  │ │Manager│ │  │ └───────────┘ │
              │  ┌───────────┐  │  │  ┌─────────┐  │  │ └───────┘ │  │ ┌───────────┐ │
              │  │  Anomaly  │  │  │  │Screenshot│ │  │ ┌───────┐ │  │ │  Rule     │ │
              │  │  Detector │  │  │  │ Verifier │ │  │ │Knowledge│ │  │ │  Engine   │ │
              │  └───────────┘  │  │  └─────────┘  │  │ │  Base  │ │  │ └───────────┘ │
              │  ┌───────────┐  │  │  ┌─────────┐  │  │ └───────┘ │  │               │
              │  │  Cron     │  │  │  │   E2E   │  │  │           │  │               │
              │  │  Monitor  │  │  │  │  Tester │  │  │           │  │               │
              │  └───────────┘  │  │  └─────────┘  │  │           │  │               │
              └────────┬────────┘  └───────┬───────┘  └─────┬─────┘  └──────┬──────┘
                       │                    │                │               │
            ┌───────────▼────────────────────▼────────────────▼──────────────▼────────┐
            │                    Notification Channels                                │
            │  Console  ·  WeChat  ·  Telegram  ·  Slack  ·  Feishu  ·  Email       │
            └───────────────────────────────────────────────────────────────────────────┘

                        Agent Stress Tester (plugins/agent-stress-tester)
                        ┌─────────────────────────────────────────────────────┐
                        │                  StressTester                        │
                        │  ┌──────────────────┐  ┌──────────────────────────┐│
                        │  │ Adversarial      │  │     Load Generator       ││
                        │  │ Generator        │  │  (spike/gradual/random)  ││
                        │  │                  │  │                          ││
                        │  │ - Prompt Injection│  │  ┌────────────────────┐  ││
                        │  │ - Jailbreak      │  │  │ DriftDetector      │  ││
                        │  │ - Edge Cases     │  │  │ (similarity-based) │  ││
                        │  │ - Role Play      │  │  └────────────────────┘  ││
                        │  │ - Privilege Esc. │  │  ┌────────────────────┐  ││
                        │  └──────────────────┘  │  │PerformanceAnalyzer │  ││
                        │                       │  │ (p50/p90/p99/QPS)  │  ││
                        │  ┌──────────────────┐  │  └────────────────────┘  ││
                        │  │ TestCase         │  └──────────────────────────┘│
                        │  │ Generator        │                               │
                        │  │ (from templates, │                               │
                        │  │  conversation,   │                               │
                        │  │  tool schemas)   │                               │
                        │  └──────────────────┘                               │
                        └─────────────────────────────────────────────────────┘

  TeamARP (Multi-Agent Management)
  ┌──────────────────────────────────────────────────────────┐
  │                      TeamARP                              │
  │  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
  │  │ Agent 1  │  │ Agent 2  │  │ Agent N  │   ...         │
  │  │ (ARP)    │  │ (ARP)    │  │ (ARP)    │               │
  │  └────┬─────┘  └────┬─────┘  └────┬─────┘               │
  │       │              │              │                      │
  │       └──────────────┼──────────────┘                      │
  │                      │                                      │
  │              ┌───────▼───────┐                             │
  │              │   Dashboard   │                             │
  │              │  (HTTP Server) │                             │
  │              │  /api/agents   │                             │
  │              │  /api/alerts   │                             │
  │              │  /api/stats    │                             │
  │              └───────────────┘                             │
  └──────────────────────────────────────────────────────────┘
```

---

## Plugin Lifecycle

### 1. SilentWatch Monitor

```
Constructor → loadConfig() → [enabled] → startMonitoring()
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
              recordToolCall()      recordResponse()       registerCronTask()
                    │                      │                      │
                    ▼                      ▼                      ▼
              ┌─────────┐           ┌───────────┐          ┌───────────┐
              │  Loop   │           │   Empty   │          │   Cron    │
              │ Detector│           │ Response  │          │  Monitor  │
              │ (state) │           │ Detector  │          │  (timer)  │
              └────┬────┘           └─────┬─────┘          └─────┬─────┘
                   │                      │                      │
                   └──────────────────────┼──────────────────────┘
                                          ▼
                                   ┌─────────────┐
                                   │  Anomaly    │
                                   │  Detector   │
                                   │  (context)  │
                                   └──────┬──────┘
                                          │
                                    [alert triggered]
                                          │
                                   ┌──────▼──────┐
                                   │  Notifiers  │
                                   │(console/wx/ │
                                   │ tg/email)   │
                                   └─────────────┘
```

### 2. Output Verifier

```
Constructor → [config] → verify() → [schema/api/screenshot/e2e]
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
              ┌───────────┐     ┌───────────┐     ┌───────────────┐
              │  Schema   │     │   API     │     │  Screenshot   │
              │ Verifier  │     │ Verifier  │     │   Verifier    │
              │(JSON Schema│     │(independent│    │ (AI Vision    │
              │ validation)│     │ ping)     │     │  API call)   │
              └─────┬─────┘     └─────┬─────┘     └───────┬───────┘
                    │                   │                   │
                    └───────────────────┼───────────────────┘
                                        ▼
                              ┌─────────────────┐
                              │  Verification   │
                              │  Report + Score │
                              └─────────────────┘
```

### 3. Cognitive Governor

```
Constructor → loadConfig() → persistPath? → loadPersistedData()
                                           │
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
              compressContext()      addAnchor()            storeKnowledge()
                    │                       │                       │
              ┌─────┴─────┐           ┌─────▼─────┐         ┌─────▼─────┐
              │ 'smart'   │           │  Anchor   │         │ Knowledge │
              │'summarize'│           │   Map     │         │   Base    │
              │'truncate' │           │ (priority)│         │   Map     │
              └─────┬─────┘           └─────┬─────┘         └─────┬─────┘
                    │                       │                       │
              tokens > threshold?     generateAnchorInjection()    searchKnowledge()
                    │                       │                       │
                    ▼                       │                       ▼
              ┌────────────┐                │                ┌───────────┐
              │ Compressed │                │                │ Relevance │
              │  Context   │                │                │  Scoring  │
              └────────────┘                │                └───────────┘
```

### 4. Permission Sentinel

```
Constructor → loadConfig() → buildRuleSet()
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
        checkCommand()         sanitize()             checkNetwork()
              │                      │                      │
        ┌─────┴─────┐          ┌─────┴─────┐         ┌─────┴─────┐
        │  Built-in │          │ Built-in  │         │  DNS/DNS  │
        │  Rules    │          │ Patterns   │         │  Rebind   │
        │(rm -rf/..)│          │(phone/API  │         │  Check    │
        └─────┬─────┘          │ key/email) │         └───────────┘
              │                └────────────┘
              ▼
        ┌────────────┐
        │ Risk Level │
        │block/confirm│
        │ /warn      │
        └────────────┘
```

### 5. Agent Stress Tester

```
Constructor → loadConfig() → runStressTest()
                                       │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
              ┌───────────┐     ┌───────────────┐    ┌─────────────┐
              │ Adversarial│   │ Load Generator │    │   Drift     │
              │ Generator  │   │  (concurrent   │    │  Detector   │
              │            │   │   test runner)  │    │             │
              └─────┬─────┘   └───────┬────────┘    └──────┬──────┘
                    │                 │                     │
              generate*Tests()  Promise.all()          compare
                                      │              similarity
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
              ┌─────────────────────────────────────────────┐
              │            StressTestReport                 │
              │  { results[], driftMetrics[], performance } │
              └─────────────────────────────────────────────┘
```

---

## Data Flow

### Typical Agent Execution Flow

```
1. Agent executes task
         │
         ▼
2. arp.watch.recordToolCall(tool, args, result, duration)
   - SilentWatch stores in circular context buffer
   - Loop detector checks consecutive call patterns
   - Timeout detector records step duration
         │
         ▼
3. arp.watch.recordResponse(content)
   - Empty response detector checks for NO_REPLY
   - Anomaly detector checks for evasive/repetitive language
   - Cron monitor checks heartbeat intervals
         │
    [if anomaly detected]
         │
         ▼
4. Alert fired → Notification channels (console/wx/tg/email)
         │
         ▼
5. arp.verify({ output, toolCalls })
   - Schema verifier validates output structure
   - API verifier independently checks endpoints
   - Screenshot verifier (AI vision) confirms UI state
         │
         ▼
6. arp.guard(command) before executing system commands
   - Permission Sentinel checks against built-in rules
   - Risk level determined: block / confirm / warn
   - sanitize() redacts sensitive data from logs
         │
         ▼
7. arp.compress(messages) during long conversations
   - Cognitive Governor applies compression strategy
   - Anchors are injected into prompt
   - Knowledge base searched for relevant solutions
         │
         ▼
8. Agent produces final output
```

### Stress Test Data Flow

```
Test Suites (adversarial/load/drift/normal)
         │
         ▼
TestCase Generator (templates/conversation history/tool schemas)
         │
         ▼
StressTester.runStressTest(testCases[])
         │
    Concurrency limiter (maxConcurrent)
         │
         ├──► TestCase 1 ──► callAgent() ──► evaluateResult()
         ├──► TestCase 2 ──► callAgent() ──► evaluateResult()
         ├──► ...
         └──► TestCase N ──► callAgent() ──► evaluateResult()
                   │
                   └──► DriftDetector (similarity scoring)
                               │
                               ▼
                    StressTestReport { results, driftMetrics, performance }
```

---

## Configuration Loading Order

### Root ARP Config (src/index.ts)

```
ARPConfig object
       │
       ├── enabled?: boolean  (default: true)
       │
       ├── watch?: SilentWatchConfig
       │         └── detectors: maxConsecutiveCalls, maxConsecutiveEmpty, stepTimeoutMs
       │         └── notifiers: { console, wechat?, telegram?, email? }
       │
       ├── verify?: OutputVerifierConfig
       │         └── verifiers: { schema, api, screenshot?, e2e }
       │
       ├── memory?: CognitiveGovernorConfig
       │         └── tokenLimit, compressionThreshold, compressionStrategy
       │
       ├── guard?: PermissionSentinelConfig
       │         └── safeCommands[], blockedCommands[]
       │
       ├── notifications?: { wechat?, telegram?, email? }
       │
       ├── alertHistoryPath?: string
       │
       ├── dataPath?: string  (persistence for governor)
       │
       └── team?: TeamConfig  (agentName, slackWebhook, feishuWebhook, dashboardPort)
```

### Plugin Config Precedence (each plugin follows same pattern)

```
1. Default values (hardcoded in plugin)
         │
         ▼
2. Config file (plugin-specific JSON, e.g. silent-watch.config.json)
         │
         ▼
3. Environment variables (plugin-specific prefixes)
         │
         ▼
4. Runtime config passed to constructor (highest priority)
```

### Environment Variable Mapping

| Plugin | Prefix | Example |
|--------|--------|---------|
| SilentWatch | `SILENT_WATCH_*` | `SILENT_WATCH_ENABLED=true`, `SILENT_WATCH_MAX_CONSECUTIVE_CALLS=10` |
| Output Verifier | (uses programmatic config only) | — |
| Cognitive Governor | (uses programmatic config only) | — |
| Permission Sentinel | `SENTINEL_*` | `SENTINEL_ENABLE_SANITIZATION=true` |
| Agent Stress Tester | `STRESS_TESTER_*` | `STRESS_TESTER_ENABLED=true`, `TARGET_AGENT=opencli`, `MAX_CONCURRENT=5`, `DRIFT_THRESHOLD=0.85` |

---

## Error Handling Mechanism

### Layer 1: Plugin-Level Error Handling

Each plugin wraps operations in try/catch and degrades gracefully:

```
SilentWatch
├── recordToolCall()     → catches errors, logs, continues monitoring
├── recordResponse()      → catches errors, logs, continues monitoring
├── Detector failures     → individual detector errors do NOT stop other detectors
└── Notifier failures     → if one notifier fails, others still fire

Output Verifier
├── Schema validation     → returns { status: 'error', score: 0, message }
├── API verification       → if API unreachable → status: 'partial' with reason
├── Screenshot verifier    → if AI API fails → status: 'skipped'
└── E2E tests             → test-level errors collected in report, don't stop suite

Cognitive Governor
├── Compression failure    → falls back to truncate strategy
├── Token counting error   → uses character-based estimation
├── Persistence error       → logs warning, continues without saving
└── Knowledge search       → returns empty results on error

Permission Sentinel
├── Rule evaluation error   → defaults to 'warn' risk level
├── Sanitization error       → returns original text unchanged
└── Network check failure    → skipped, not blocking

Agent Stress Tester
├── Test case failure        → collected in results[], does NOT stop other tests
├── Agent call timeout       → caught as errorResult with passed: false
├── Drift detection error    → skipped for that test case
└── Load generator error     → aborts that scenario, continues others
```

### Layer 2: ARP Unified Error Handling

```
arp.verify()
├── catches all verifier errors
├── returns VerificationResult with status: 'error'
└── never throws to caller

arp.watch.recordToolCall()
├── wraps all detector checks in try/catch
└── always succeeds (void return)

arp.guard() / arp.sanitize()
├── always returns a result (never throws)
└── on internal error → returns { allowed: false, reason: 'check failed' }

arp.compress()
├── catches all errors
├── returns { messages: original, summary: error_summary } on failure
```

### Layer 3: TeamARP Error Isolation

```
addAgent(name, config)
├── each agent is fully isolated
└── one agent's error does NOT affect other agents

dashboard()
├── HTTP errors caught and returned as JSON error responses
└── never crashes the process
```

### Error Recovery Patterns Used

| Pattern | Where Used |
|---------|-----------|
| Graceful degradation | Screenshot verifier without API key, network checks |
| Fallback defaults | Compression strategy fallback, token counter fallback |
| Error aggregation | Verification report collects all errors, stress test report |
| Circuit breaker | Notifier failures don't cascade |
| Fail-safe defaults | Sentinel returns `warn` on rule evaluation error |
| Void-safety | All `record*` methods return void and never throw |

---

## Test Suite Structure

```
npm test              # Root integration tests (21 tests)
npm run test:all      # All plugins + root tests

test:all execution order:
  1. npm run test:silent-watch       (plugins/silent-watch)
  2. npm run test:output-verifier     (plugins/output-verifier)
  3. npm run test:cognitive-governor  (plugins/cognitive-governor)
  4. npm run test:permission-sentinel (plugins/permission-sentinel)
  5. npm run test:agent-stress-tester (plugins/agent-stress-tester)  ← added
  6. npm test                         (root: src/ + tests/)

Each plugin test runs its own Jest suite independently.
Plugins have their own jest.config.js and node_modules.
```
