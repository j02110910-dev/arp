# ARP - Agent Reliability Platform

All-in-one reliability platform for AI Agents. Monitoring, verification, memory management, and security — in a single npm package.

```bash
npm install arp
```

---

## Features

### 🔍 Smart Monitoring

Detect silent failures in real-time while your agent executes tasks:

- **Loop Detection** — Agent calling the same tool repeatedly without progress? Instant alert.
- **Empty Response Detection** — Agent returning empty replies or NO_REPLY? Detects crashes.
- **Timeout Detection** — Single step takes over 60s? Immediate notification.
- **Cron Miss Detection** — Scheduled tasks or heartbeats not firing? Get alerted.
- **Behavior Anomaly** — Detects evasive language, repetition patterns, and behavior drift.

Alert channels: Console, WeChat (Server酱), Telegram, Slack, Feishu, Email.

### ✅ Output Verification

Your agent says "done" — but is it really?

- **Schema Validation** — Validate output against JSON Schema. Check types, required fields, enums, ranges.
- **API Verification** — Agent claims an API call succeeded? ARP independently queries the endpoint to confirm.
- **Screenshot Verification** — Agent says "UI updated"? ARP uses AI vision to analyze the screenshot. (Requires your own vision API key)
- **E2E Testing** — Write custom test cases with assertions. Built-in veto mechanism for critical checks.
- **Error Detection** — Output contains "Error:" or "Exception"? Auto-fail, no exceptions.

### 🧠 Memory Management

Keep your agent smart during long conversations:

- **Context Compression** — Compress 50 messages into 15 summaries. Saves 70% tokens. 3 strategies: smart, summarize, truncate.
- **Instruction Anchors** — Pin critical task goals to the end of your prompt. Never lost, even in 100+ message conversations. Supports priority and expiration.
- **Knowledge Base** — Agent solved a problem? Auto-store the solution. Search and reuse later with tags and relevance scoring.

### 🛡️ Security Firewall

Protect your system from dangerous agent actions:

- **Dangerous Command Blocking** — `rm -rf /`, `curl | bash`, `DROP TABLE`, `mkfs` — blocked instantly.
- **Confirmation Required** — `sudo`, `chmod 777`, SSH key access — requires user approval.
- **Sensitive Data Sanitization** — Phone numbers, emails, API keys, passwords, credit cards, IP addresses — auto-redacted in logs.
- **Custom Rules** — Add your own security rules with whitelist/blacklist support.

### 👥 Multi-Agent Management

Running multiple agents? Manage them all with TeamARP:

- Add unlimited agents, each with independent configuration.
- Unified dashboard at `http://localhost:3000/api/agents`.
- Aggregated alerts across all agents.

---

## Install

```bash
npm install arp
```

---

## Quick Start

```typescript
import { ARP } from 'arp';

const arp = new ARP({
  notifications: {
    wechat: { key: 'YOUR_SERVER_KEY' },     // optional
    telegram: { botToken: 'xxx', chatId: 'xxx' }, // optional
  },
});

// Monitor agent execution
arp.watch.recordToolCall('search', { query: 'users' }, results, 120);
arp.watch.recordResponse('Found 42 users');

// Verify agent output
const result = await arp.verify(
  { output: { userId: 42, name: 'Alice' } },
  { requiredFields: ['userId', 'name'] }
);
// → { status: 'passed', score: 100 }

// Security check
arp.guard('rm -rf /');
// → { allowed: false, riskLevel: 'critical', reason: 'Dangerous rm command' }

// Sanitize sensitive data
arp.sanitize('Phone: 13812345678, Email: alice@test.com');
// → { sanitized: 'Phone: [PHONE_REDACTED], Email: [EMAIL_REDACTED]' }

// Memory management
const { messages } = arp.compress(longConversation); // 50 → 15
arp.anchor('Complete the registration flow', 10);    // pinned to prompt
arp.learn('JWT refresh fails', 'Use refresh token rotation', ['auth']);
const knowledge = arp.recall('JWT refresh');          // search knowledge base
```

---

## API Reference

```typescript
// Monitoring
arp.watch.recordToolCall(tool, args, result, duration)
arp.watch.recordResponse(content)
arp.watch.recordCron(name, id)
arp.watch.stats()           // { totalEvents, totalAlerts, ... }
arp.watch.alerts(limit)     // recent alerts
arp.watch.health()          // health check

// Verification
await arp.verify(claim, options?)  // verify agent claim

// Memory
arp.compress(messages)       // compress context
arp.anchor(text, priority?)  // add instruction anchor
arp.unanchor(id)             // remove anchor
arp.anchorText()             // get anchor injection text
arp.learn(problem, solution, tags?)  // store knowledge
arp.recall(text, limit?)     // search knowledge
arp.contextHealth(messages?) // context health metrics

// Security
arp.guard(command)           // check command safety
arp.sanitize(text)           // redact sensitive data
arp.guardStats()             // security statistics

// Multi-Agent
const team = new TeamARP();
team.addAgent('bot-1', config);
team.dashboard(3000);        // http://localhost:3000/api/agents

// Lifecycle
arp.stop()
```

---

## Tests

```bash
npm test           # 21 integration tests
npm run test:all   # 159 tests across all plugins
```

| Plugin | Tests |
|--------|-------|
| SilentWatch | 17 |
| Output Verifier | 69 |
| Cognitive Governor | 22 |
| Permission Sentinel | 30 |
| ARP Integration | 21 |
| **Total** | **159** |

---

## License

MIT
