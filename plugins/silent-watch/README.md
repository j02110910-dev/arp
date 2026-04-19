# SilentWatch

Agent Silent Failure Detector for AI Agents

SilentWatch monitors AI agent execution for silent failures, loops, timeouts, and anomalous behavior patterns. It provides configurable detection thresholds and multiple notification channels.

## Features

- 🔄 **Loop Detection**: Detects when the same tool is called repeatedly without progress
- 🚫 **Empty Response Detection**: Detects consecutive empty or NO_REPLY responses
- ⏱ **Timeout Detection**: Detects when a single operation exceeds expected duration
- ⏰ **Cron Miss Detection**: Monitors scheduled/heartbeat tasks and alerts when they're missed
- 📊 **Anomaly Detection**: Detects behavioral patterns like repetitive responses and evasive behavior

## Installation

\`\`\`bash
npm install -g silent-watch
\`\`\`

## Quick Start

\`\`\`bash
# Basic usage
silent-watch monitor

# With HTTP API server
silent-watch server --port 3000

# Check health status
silent-watch health
\`\`\`

## Configuration

SilentWatch can be configured via environment variables or a config file.

### Environment Variables

Create a \`.env\` file in your project root:

\`\`\`bash
# Enable/disable monitoring
SILENT_WATCH_ENABLED=true

# Detector thresholds
SILENT_WATCH_MAX_CONSECUTIVE_CALLS=10
SILENT_WATCH_MAX_CONSECUTIVE_EMPTY=3
SILENT_WATCH_STEP_TIMEOUT_MS=60000
SILENT_WATCH_CONTEXT_SIZE=10

# HTTP server
SILENT_WATCH_PORT=3000

# API authentication (optional)
SILENT_WATCH_API_KEY=your-secret-key
SILENT_WATCH_REQUIRE_AUTH=false

# Debug mode
DEBUG=true
\`\`\`

### Config File

Create a \`silent-watch.config.json\` file:

\`\`\`json
{
  "enabled": true,
  "detectLoops": true,
  "detectEmptyResponses": true,
  "detectTimeouts": true,
  "detectCronMisses": true,
  "detectAnomalies": true,
  "detectors": {
    "maxConsecutiveCalls": 10,
    "maxConsecutiveEmpty": 3,
    "stepTimeoutMs": 60000,
    "contextSnapshotSize": 10
  },
  "notifiers": {
    "console": {
      "enabled": true,
      "level": "info"
    }
  },
  "apiKey": "your-secret-api-key",
  "server": {
    "requireAuth": true
  },
  "alertHistoryPath": "./alert-history.json"
}
\`\`\`

## CLI Commands

\`\`\`bash
# Start foreground monitoring
silent-watch monitor

# Show statistics
silent-watch status

# Show recent alerts
silent-watch events --limit 20

# Show health check
silent-watch health

# Show configuration
silent-watch config

# Record an event manually
silent-watch record --type tool_call --tool search_database --duration 150

# Start HTTP API server
silent-watch server --port 3000
\`\`\`

## API Reference

### Health Check

\`\`\`
GET /health
\`\`\`

Returns monitoring health and detector status.

Response:
\`\`\`json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "uptime": 123,
  "lastCheck": "2026-04-19T20:00:00.000Z",
  "detectors": {
    "loop": "active",
    "empty_response": "active",
    "timeout": "active",
    "cron_missed": "active",
    "anomaly": "active"
  },
  "notifiers": {
    "console": "active",
    "wechat": "inactive",
    "telegram": "inactive",
    "email": "inactive"
  }
}
\`\`\`

### Get Recent Alerts

\`\`\`
GET /events?limit=10
\`\`\`

Headers (when auth enabled):
\`\`\`
X-API-Key: your-secret-api-key
\`\`\`

Response:
\`\`\`json
{
  "alerts": [...],
  "total": 42
}
\`\`\`

### Record Event

\`\`\`
POST /record
Content-Type: application/json
X-API-Key: your-secret-api-key (when auth enabled)

Body:
\`\`\`json
{
  "type": "tool_call" | "cron_trigger",
  "tool": "search_database",
  "content": "Response content",
  "duration": 150,
  "args": { "query": "users" },
  "result": [...]
}
\`\`\`

## Security

### API Authentication

To enable API authentication:

1. Set \`SILENT_WATCH_API_KEY\` environment variable or \`apiKey\` in config file
2. Set \`SILENT_WATCH_REQUIRE_AUTH=true\` or \`server.requireAuth=true\` in config

All API endpoints will then require the \`X-API-Key\` header.

## Programmatic Usage

\`\`\`typescript
import { SilentWatchMonitor, loadConfig } from 'silent-watch';

const config = loadConfig();
const monitor = new SilentWatchMonitor(config);

// Record events
monitor.recordToolCall('search_database', { query: 'users' }, results, 150);
monitor.recordResponse('Found 42 users matching your query');

// Register a scheduled task
monitor.registerCronTask('daily_report', 'report_001', 86400000); // 24 hours
monitor.recordCronTrigger('daily_report', 'report_001');

// Get stats
const stats = monitor.getStats();
console.log(stats);

// Get performance metrics
const perf = monitor.getPerformanceMetrics();
console.log(perf);
\`\`\`

## Alerts

SilentWatch can trigger the following alert types:

- \`loop_detected\`: Same tool called repeatedly
- \`empty_response\`: Consecutive empty/NO_REPLY responses
- \`timeout\`: Single operation exceeded timeout
- \`cron_missed\`: Scheduled task not executed
- \`anomaly\`: Behavioral anomaly detected

## Development

\`\`\`bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Run in development
npm run dev
\`\`\`

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
