# Cognitive Governor

**Agent Reliability Platform - Part 3: Memory & Context Management**

Solve long conversation memory loss and context pollution problems. Cognitive Governor manages context compression, critical instruction anchoring, and a knowledge base for agent experience reuse.

---

## Features

### Context Compression
- **Smart Strategy** — Keeps system messages + recent messages, summarizes the middle section
- **Summarize Strategy** — Creates a single summary of older messages
- **Truncate Strategy** — Keeps only recent messages that fit within token limit
- **Token-Aware** — Estimates token usage to avoid exceeding limits
- **Topic Preservation** — Extracts and preserves key topics during compression

### Instruction Anchoring
- **Priority-Based Anchors** — Critical instructions pinned to prompt end
- **Expiration Support** — Anchors can expire after a given time
- **Tag-Based Organization** — Tag anchors for categorization
- **Automatic Injection** — `generateAnchorInjection()` produces prompt-ready text

### Knowledge Base
- **Problem-Solution Storage** — Agent stores solutions for later reuse
- **Relevance Scoring** — Keyword matching + tag matching + recency + usage frequency
- **Cache Hit Tracking** — Monitors knowledge base hit rate
- **Persistent Storage** — Knowledge survives restarts (optional)

### Health Monitoring
- **Token Usage Tracking** — Monitor context health as percentage of limit
- **Compression History** — Track all compression events
- **Anchor Statistics** — Active anchor count and limits

---

## Installation

```bash
npm install @arp/cognitive-governor
```

---

## Quick Start

```typescript
import { CognitiveGovernor, loadConfig } from '@arp/cognitive-governor';

const governor = new CognitiveGovernor({
  enabled: true,
  tokenLimit: 8000,
  compressionThreshold: 0.7,
  compressionStrategy: 'smart', // 'smart' | 'summarize' | 'truncate'
  maxAnchors: 10,
  maxKnowledgeEntries: 100,
});

// Compress long conversation
const messages = [
  { role: 'system', content: 'You are a helpful assistant', timestamp: new Date() },
  { role: 'user', content: 'Help me with my Python code', timestamp: new Date() },
  { role: 'assistant', content: 'I would be happy to help with your Python code...', timestamp: new Date() },
  // ... 50 more messages
];

const { compressed, summary, anchors } = governor.compressContext(messages);
console.log(`Compressed ${messages.length} → ${compressed.length} messages`);
console.log(`Saved ~${summary.tokensSaved} tokens`);

// Add a critical instruction anchor
const anchor = governor.addAnchor(
  'Always validate user input before processing',
  10,        // priority (higher = more important)
  ['security'], // tags
  new Date(Date.now() + 3600000) // expires in 1 hour
);

// Generate anchor injection text for prompt
const injection = governor.generateAnchorInjection();
// → "[Critical Instructions - Always Remember]\n- Always validate user input before processing\n[End Critical Instructions]"

// Store knowledge from a solved problem
governor.storeKnowledge(
  'JWT refresh token fails with 401',
  'Use refresh token rotation: issue new refresh token on each refresh, store rotation state',
  ['auth', 'jwt', 'security']
);

// Search knowledge base
const results = governor.searchKnowledge({ text: 'token expiration', limit: 3 });
results.forEach(entry => {
  console.log(`${entry.problem} → ${entry.solution} (score: ${entry.relevanceScore})`);
});

// Check context health
const health = governor.getHealth(messages);
console.log(`Context health: ${health.usagePercent}% (${health.totalTokens}/${health.tokenLimit} tokens)`);
```

---

## Configuration

```typescript
interface CognitiveGovernorConfig {
  enabled?: boolean;
  tokenLimit?: number;            // max tokens in context (default: 8000)
  compressionThreshold?: number;  // compress when token% > threshold (default: 0.7)
  compressionStrategy?: 'smart' | 'summarize' | 'truncate'; // default: 'smart'
  maxAnchors?: number;            // max pinned anchors (default: 10)
  maxKnowledgeEntries?: number;  // max knowledge base entries (default: 100)
  persistencePath?: string;        // file path for persistence (optional)
  tokenCounter?: (content: string) => number; // custom token counter
}
```

---

## Compression Strategies

### Smart (Default)
Keeps system messages + first user message + summarized middle + recent messages.

```
Before: [S1, S2, U1, A1, A2, A3, A4, A5, U2, A6, A7, A8]
After:  [S1, S2, U1, [Middle Summary], U2, A6, A7, A8]
```

### Summarize
Replaces all but the last 5 messages with a single summary.

```
Before: [U1, A1, A2, A3, A4, A5, U2, A6, A7, A8]
After:  [[Full Summary of U1-A5], U2, A6, A7, A8]
```

### Truncate
Keeps only the most recent messages that fit within the token limit.

```
Before: [U1, A1, A2, A3, A4, A5, U2, A6, A7, A8] (100 messages)
After:  [A4, A5, U2, A6, A7, A8] (fits within limit)
```

---

## API Reference

### CognitiveGovernor

```typescript
const governor = new CognitiveGovernor(config);
```

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `compressContext(messages)` | `{ compressed, summary, anchors }` | Compress conversation to fit token limit |
| `addAnchor(instruction, priority, tags?, expiresAt?)` | `Anchor` | Pin a critical instruction |
| `removeAnchor(id)` | `boolean` | Remove an anchor |
| `getActiveAnchors()` | `Anchor[]` | Get all active anchors sorted by priority |
| `generateAnchorInjection()` | `string` | Get anchor text ready for prompt injection |
| `storeKnowledge(problem, solution, tags?)` | `KnowledgeEntry` | Store a problem-solution pair |
| `searchKnowledge(query)` | `KnowledgeEntry[]` | Search knowledge base |
| `useKnowledge(id)` | `void` | Increment usage counter for an entry |
| `getHealth(messages?)` | `ContextHealth` | Get context health metrics |
| `getCompressionHistory()` | `CompressedContext[]` | Get all past compression summaries |
| `getKnowledgeEntries()` | `KnowledgeEntry[]` | Get all knowledge entries |
| `stop()` | `void` | Clean up and persist data |

### Types

```typescript
interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface CompressedContext {
  id: string;
  originalMessageCount: number;
  summary: string;
  tokensSaved: number;
  timeRange: { start: Date; end: Date };
  preservedTopics: string[];
  timestamp: Date;
}

interface Anchor {
  id: string;
  instruction: string;
  priority: number;
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
  relevanceScore: number;
  createdAt: Date;
  lastUsedAt?: Date;
}

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

---

## Integration with ARP

```typescript
import { ARP } from 'arp';

const arp = new ARP({
  memory: {
    enabled: true,
    tokenLimit: 8000,
    compressionThreshold: 0.7,
    strategy: 'smart',
  },
});

// Compress conversation
const { messages } = arp.compress(longConversation);

// Add anchor
arp.anchor('Complete the registration flow', 10);

// Generate prompt with anchors
const promptWithAnchors = `
System: You are a helpful assistant.
${longConversation.map(m => `${m.role}: ${m.content}`).join('\n')}

${arp.anchorText()}  // ← Critical instructions injected here
`;

// Store and recall knowledge
arp.learn('JWT refresh fails', 'Use refresh token rotation', ['auth']);
const knowledge = arp.recall('JWT refresh');
```

---

## Token Counting

By default, Cognitive Governor estimates tokens as `ceil(content.length / 4)`. For more accurate counting, provide a custom token counter:

```typescript
const governor = new CognitiveGovernor({
  tokenLimit: 8000,
  tokenCounter: (content: string) => {
    // Use your preferred tokenizer (tiktoken, etc.)
    return myTokenizer.encode(content).length;
  },
});
```

---

## Persistence

Data is persisted to a JSON file when `persistencePath` is configured:

```typescript
const governor = new CognitiveGovernor({
  persistencePath: './arp-data.json',
});
```

Persisted data includes:
- Anchors (with creation timestamps)
- Knowledge base entries
- Compression history (last 50 summaries)

---

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Lint
npm run lint
```

---

## Architecture

See [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) for full system architecture including plugin lifecycle, data flow, and error handling.

---

## Pricing

| Plan | Price | Description |
|------|-------|-------------|
| Free | $0 | Basic features for local development |
| Pro | $50/mo | Full features with unlimited agents |
| Enterprise | $50/mo | Custom integrations and priority support |

---

## License

MIT
