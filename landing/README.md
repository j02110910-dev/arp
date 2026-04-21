# ARP - Agent Reliability Platform

**Stop your AI agents from failing silently.**

[![npm version](https://img.shields.io/npm/v/arp.svg)](https://npmjs.com/package/arp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/159%20tests-passing-brightgreen)](https://github.com/j02110910-dev/arp)

One npm package for monitoring, verification, memory management, and security of your AI agents.

---

## Install

```bash
npm install arp
```

## What Does ARP Do?

AI agents break in ways you don't notice — until customers complain.

ARP fixes that. It monitors your agent's health, verifies outputs before you trust them, manages context in long conversations, and blocks dangerous commands before they run.

### Who is ARP for?

- **Developers building AI agents** — you want reliability guarantees before shipping
- **Teams running AI in production** — you need observability and alerts
- **Enterprise AI deployments** — you need security, compliance, and audit trails

## Quick Start

```typescript
import { ARP } from 'arp';

const arp = new ARP({
  notifications: {
    telegram: { botToken: 'xxx', chatId: 'xxx' },
  },
});

// Monitor
arp.watch.recordToolCall('search', { query: 'users' }, result, 120);
arp.watch.recordResponse('Found 42 users');

// Verify
const verified = await arp.verify(
  { output: { userId: 42, name: 'Alice' } },
  { requiredFields: ['userId', 'name'] }
);

// Secure
arp.guard('rm -rf /');
// → { allowed: false, riskLevel: 'critical' }

// Compress context
const { messages } = arp.compress(longConversation); // 50 → 15 messages
```

## Key Features

| Feature | What it does |
|---------|--------------|
| **Smart Monitoring** | Detects loops, timeouts, empty responses, behavior anomalies |
| **Output Verification** | Schema validation, API verification, screenshot verification |
| **Memory Management** | Context compression (70% token savings), instruction anchors, knowledge base |
| **Security Firewall** | Blocks dangerous commands, sanitizes sensitive data, requires approval for sudo |

## Pricing

ARP has a **free MIT-licensed core** and a **$29/mo Pro tier** with advanced features.

See [PRICING.md](./PRICING.md) for full details.

| | Free | Pro |
|--|------|-----|
| Core monitoring | ✓ | ✓ |
| Output verification | ✓ | ✓ |
| Memory management | ✓ | ✓ |
| Security firewall | ✓ | ✓ |
| Multi-agent dashboard | — | ✓ |
| Advanced anomaly detection | — | ✓ |
| Screenshot verification | — | ✓ |
| Priority support | — | ✓ |
| Commercial license | — | ✓ |

## Links

- **[Landing Page](index.html)** — Product page with full feature details and pricing
- **[npm Package](https://npmjs.com/package/arp)** — Install via npm
- **[GitHub](https://github.com/j02110910-dev/arp)** — Source code, issues, PRs welcome
- **[Documentation](https://github.com/j02110910-dev/arp#readme)** — Full API reference

## License

ARP Core is MIT licensed. Pro tier is commercial.

---

**Questions?** Open an issue on GitHub or email j02110910@gmail.com
