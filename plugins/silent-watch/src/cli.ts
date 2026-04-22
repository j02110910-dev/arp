#!/usr/bin/env node
/**
 * SilentWatch CLI
 * Command-line interface for silent failure detector
 */

import { SilentWatchMonitor, loadConfig } from './index';
import { createLogger } from './logger';
import { createServer } from 'http';

const logger = createLogger({ plugin: 'silent-watch', detector: 'cli' });

// Parse command line arguments
const args = process.argv.slice(2);

// Status interval tracker
let statusInterval: NodeJS.Timeout | null = null;

function printUsage(): void {
  console.log(`
SilentWatch - Agent Silent Failure Detector

Usage:
  silent-watch [command] [options]

Commands:
  monitor     Start monitoring in foreground (default)
  status      Show current monitoring statistics
  events      Show recent events and alerts
  config      Show current configuration
  record      Manually record an event
  server      Start HTTP server for remote event ingestion
  health      Show health check status
  help        Show this help message

Options:
  --limit N   Limit number of results (for events command)

Examples:
  silent-watch monitor
  silent-watch status
  silent-watch events --limit 20
  silent-watch server --port 3000
  silent-watch record --type tool_call --tool search_database --duration 150
  silent-watch health

Environment Variables:
  SILENT_WATCH_ENABLED              Enable/disable monitor (default: true)
  SILENT_WATCH_MAX_CONSECUTIVE_CALLS   Max same tool calls before alert (default: 10)
  SILENT_WATCH_MAX_CONSECUTIVE_EMPTY   Max empty responses before alert (default: 3)
  SILENT_WATCH_STEP_TIMEOUT_MS          Step timeout in ms (default: 60000)
  SILENT_WATCH_CONTEXT_SIZE            Context snapshot size (default: 10)
  SILENT_WATCH_PORT                   HTTP server port (default: 3000)

For WeChat/Telegram/Email notifications, see README.md

For more information, see: https://github.com/silent-watch/silent-watch
`);
}

async function cmdStatus(monitor: SilentWatchMonitor): Promise<void> {
  const stats = monitor.getStats();
  const loadedAlerts = monitor.getRecentAlerts(9999);
  console.log('\n=== SilentWatch Status ===\n');
  console.log(`Uptime (this session): ${Math.floor(stats.uptimeSeconds / 3600)}h ${Math.floor((stats.uptimeSeconds % 3600) / 60)}m`);
  console.log(`Events (this session): ${stats.totalEvents}`);
  console.log(`Alerts (this session): ${stats.totalAlerts}`);
  console.log(`Loaded alerts (disk):  ${loadedAlerts.length}`);
  if (loadedAlerts.length > 0) {
    console.log(`Last alert: ${loadedAlerts[loadedAlerts.length - 1].timestamp.toLocaleString()}`);
  }
  console.log('\nNote: `silent-watch monitor` or `silent-watch server` provides real-time stats.');
  console.log('\nAlerts by Type (this session):');
  for (const [type, count] of Object.entries(stats.alertsByType)) {
    console.log(`  ${type}: ${count}`);
  }
}

async function cmdEvents(monitor: SilentWatchMonitor, limit: number): Promise<void> {
  const alerts = monitor.getRecentAlerts(limit);
  console.log(`\n=== Recent Alerts (${alerts.length}) ===\n`);

  if (alerts.length === 0) {
    console.log('No alerts recorded yet.');
    return;
  }

  for (const alert of alerts) {
    const emoji = alert.acknowledged ? '✅' :
                  alert.severity === 'critical' ? '🔴' :
                  alert.severity === 'high' ? '🟠' :
                  alert.severity === 'medium' ? '🟡' : '🔵';
    console.log(`${emoji} [${alert.timestamp.toLocaleString()}] ${alert.type}`);
    console.log(`   ${alert.message}`);
    if (alert.acknowledged) {
      console.log('   ✅ Acknowledged');
    }
    console.log();
  }
}

async function cmdConfig(monitor: SilentWatchMonitor): Promise<void> {
  console.log('\n=== SilentWatch Configuration ===\n');
  console.log('Use environment variables to configure. Run `silent-watch help` for details.');
  console.log('\nDetectors: All enabled (configured via SilentWatchConfig)');
}

async function cmdHealth(monitor: SilentWatchMonitor): Promise<void> {
  const health = monitor.healthCheck();
  console.log('\n=== SilentWatch Health Check ===\n');
  console.log(`Status:       ${health.status.toUpperCase()}`);
  console.log(`Uptime:       ${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m`);
  console.log(`Last Check:   ${health.lastCheck.toLocaleString()}`);
  console.log('\nDetectors:');
  for (const [name, status] of Object.entries(health.detectors)) {
    const icon = status === 'active' ? '✅' : status === 'inactive' ? '⚪' : '❌';
    console.log(`  ${icon} ${name}: ${status}`);
  }
  console.log('\nNotifiers:');
  for (const [name, status] of Object.entries(health.notifiers)) {
    const icon = status === 'active' ? '✅' : status === 'inactive' ? '⚪' : '❌';
    console.log(`  ${icon} ${name}: ${status}`);
  }
}

async function cmdRecord(monitor: SilentWatchMonitor, options: Record<string, string>): Promise<void> {
  const type = options.type || 'normal';
  const tool = options.tool;
  const duration = options.duration ? parseInt(options.duration, 10) : undefined;
  const content = options.content || '';

  switch (type) {
    case 'tool_call':
      if (!tool) {
        logger.error('Tool name is required for tool_call events', { type });
        process.exit(1);
      }
      monitor.recordToolCall(tool, undefined, undefined, duration);
      logger.info('Tool call recorded', { tool, duration });
      break;
    case 'response':
    case 'normal':
      monitor.recordResponse(content || options.text || 'NO_REPLY');
      logger.info('Response recorded', { contentPreview: content.substring(0, 50) });
      break;
    case 'cron_trigger':
      monitor.recordCronTrigger(tool || 'unnamed', options.jobId || 'default');
      logger.info('Cron trigger recorded', { jobName: tool, jobId: options.jobId });
      break;
    default:
      // Type from CLI is a user-provided string - pass through directly
      monitor.recordEvent({
        timestamp: new Date(),
        type,
        tool,
        duration,
        content,
        metadata: options,
      });
      logger.info('Event recorded', { type });
  }
}

function parseArgs(rawArgs: string[]): { command: string; options: Record<string, string> } {
  const command = rawArgs[0] || 'monitor';
  const options: Record<string, string> = {};

  // Simple key=value parsing
  for (const arg of rawArgs.slice(1)) {
    if (arg.startsWith('--')) {
      const [key, ...valueParts] = arg.slice(2).split('=');
      if (key && valueParts.length > 0) {
        options[key] = valueParts.join('=');
      } else if (key) {
        options[key] = 'true';
      }
    } else if (arg.startsWith('-')) {
      options[arg.slice(1)] = 'true';
    }
  }

  return { command, options };
}

async function startHttpServer(monitor: SilentWatchMonitor, port: number): Promise<void> {
  const MAX_BODY_SIZE = 1024 * 1024; // 1MB
  const config = loadConfig();
  const requireAuth = config.server?.requireAuth || false;
  const validApiKey = config.apiKey;

  const server = createServer((req, res) => {
    // 安全配置
    req.setTimeout(30000); // 30秒超时
    req.setMaxListeners(0);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
    res.setHeader('X-API-Version', '1.0.0');

    // API Key authentication (if enabled)
    if (requireAuth && validApiKey) {
      const providedKey = req.headers['x-api-key'] || req.headers['authorization'];
      if (providedKey !== validApiKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized', message: 'Missing or invalid API key' }));
        return;
      }
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // 验证Content-Type for POST requests
    if (req.method === 'POST') {
      const contentType = req.headers['content-type'];
      if (!contentType?.includes('application/json')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid Content-Type. Expected application/json' }));
        return;
      }
    }

    // Parse URL
    const baseUrl = 'http://localhost:' + port;
    const url = new URL(req.url || '/', baseUrl);

    if (url.pathname === '/health' && req.method === 'GET') {
      const health = monitor.healthCheck();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(health));
      return;
    }

    if (url.pathname === '/events' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '10', 10);
      const alerts = monitor.getRecentAlerts(limit);
      const totalAlerts = monitor.getStats().totalAlerts;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 'alerts': alerts, 'total': totalAlerts }));
      return;
    }

    if (url.pathname === '/record' && req.method === 'POST') {
      let body = '';
      let bodySize = 0;

      req.on('data', (chunk) => {
        bodySize += chunk.length;
        body += chunk;
      });

      req.on('end', () => {
        if (bodySize === 0) {
          res.writeHead(411, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Empty request body' }));
          return;
        }
        if (bodySize > MAX_BODY_SIZE) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Request body too large (max 1MB)' }));
          return;
        }

        try {
          const data = JSON.parse(body);
          if (data.type === 'tool_call' && data.tool) {
            monitor.recordToolCall(data.tool, data.args, data.result, data.duration);
          } else if (data.content !== undefined) {
            monitor.recordResponse(data.content);
          } else if (data.type === 'cron_trigger') {
            monitor.recordCronTrigger(data.jobName || 'unknown', data.jobId || 'unknown');
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON format' }));
        }
      });
      return;
    }

    // Default: return API docs
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const apiDocs = {
      name: 'SilentWatch API',
      version: '1.0.0',
      endpoints: {
        'GET /health': 'Health check',
        'GET /events?limit=N': 'Get recent alerts',
        'POST /record': 'Record event with type, tool, content, duration, result, args',
      },
    };
    res.end(JSON.stringify(apiDocs));
  });

  let serverClosed = false;

  const cleanup = () => {
    if (!serverClosed) {
      serverClosed = true;
      logger.info('Server shutdown initiated');
      server?.close();
    }
  };

  server.listen(port, () => {
    logger.info('HTTP server started', {
      port,
      endpoints: {
        health: 'http://localhost:' + port + '/health',
        events: 'http://localhost:' + port + '/events',
        record: 'POST http://localhost:' + port + '/record'
      }
    });
  });

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

async function main(): Promise<void> {
  const { command, options } = parseArgs(args);

  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      printUsage();
      break;

    case 'status':
    case 'stats': {
      const config = loadConfig();
      const statusMonitor = new SilentWatchMonitor(config);
      await cmdStatus(statusMonitor);
      process.exit(0);
    }

    case 'events': {
      const config = loadConfig();
      const eventsMonitor = new SilentWatchMonitor(config);
      const limit = options.limit ? parseInt(options.limit, 10) : 10;
      await cmdEvents(eventsMonitor, limit);
      process.exit(0);
      break;
    }

    case 'health': {
      const config = loadConfig();
      const healthMonitor = new SilentWatchMonitor(config);
      await cmdHealth(healthMonitor);
      process.exit(0);
      break;
    }

    case 'config': {
      const config = loadConfig();
      const configMonitor = new SilentWatchMonitor(config);
      await cmdConfig(configMonitor);
      process.exit(0);
      break;
    }

    case 'record': {
      const config = loadConfig();
      const recordMonitor = new SilentWatchMonitor(config);
      await cmdRecord(recordMonitor, options);
      process.exit(0);
      break;
    }

    case 'server': {
      const config = loadConfig();
      const serverMonitor = new SilentWatchMonitor(config);

      // 安全解析端口
      const envPort = process.env.SILENT_WATCH_PORT;
      const defaultPort = 3000;
      const optPort = options.port ? options.port.trim() : '';
      const port = optPort && optPort !== ''
        ? parseInt(optPort, 10)
        : (envPort ? parseInt(envPort, 10) : defaultPort);

      // 验证端口
      if (isNaN(port)) {
        logger.error('Invalid port: must be a number', { port, providedValue: optPort });
        process.exit(1);
      }
      if (port < 1 || port > 65535) {
        logger.error('Invalid port: must be between 1 and 65535', { port });
        process.exit(1);
      }

      await startHttpServer(serverMonitor, port);
      break;
    }

    case 'monitor':
    default: {
      const config = loadConfig();
      const monitor = new SilentWatchMonitor(config);

      console.log(`
╔═════════════════════════════════════════╗
║         SilentWatch Monitor Started            ║
║   Agent Silent Failure Detector v0.1.0       ║
╠═══════════════════════════════════════════╣
║  Commands:                                   ║
║  - silent-watch status     (Ctrl+C to stop) ║
║  - silent-watch events                       ║
║  - silent-watch server      (HTTP API)       ║
║  - silent-watch help        (more options)   ║
╚═════════════════════════════════════════════╝
`);

      // Keep process alive and print stats periodically
      statusInterval = setInterval(async () => {
        await cmdStatus(monitor);
      }, 60000); // Every minute
    }
  }
}

main().catch(error => {
  logger.error('Application error', { error: String(error) });
  process.exit(1);
});
