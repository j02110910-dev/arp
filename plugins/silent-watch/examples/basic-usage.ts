/**
 * Example: Basic SilentWatch Usage
 * Demonstrates how to integrate SilentWatch with your AI agent
 */

import { SilentWatchMonitor, loadConfig } from '../src/index';

// Initialize monitor with default config (from environment)
const config = loadConfig();
const monitor = new SilentWatchMonitor(config);

console.log('SilentWatch Basic Example');
console.log('========================\n');

// Simulate an agent session with various events

// 1. Tool calls
console.log('Recording tool calls...');
monitor.recordToolCall('search_database', { query: 'users' }, [{ id: 1, name: 'Alice' }], 120);
monitor.recordToolCall('fetch_user_details', { userId: 1 }, { id: 1, name: 'Alice', email: 'alice@example.com' }, 80);
monitor.recordToolCall('send_email', { to: 'alice@example.com', subject: 'Hello' }, { sent: true }, 200);

// 2. Normal response
monitor.recordResponse('Successfully sent email to alice@example.com');

// 3. Simulate a loop scenario (same tool called many times)
console.log('\nSimulating loop scenario...');
for (let i = 0; i < 12; i++) {
  // Each call with same result indicates no progress
  monitor.recordToolCall('retry_operation', { attempt: i }, { status: 'pending' }, 50);
}

// 4. Simulate empty response scenario
console.log('Simulating empty response scenario...');
monitor.recordResponse('NO_REPLY');
monitor.recordResponse('NO_REPLY');
monitor.recordResponse('');

// 5. Register and trigger cron monitoring
console.log('\nSetting up cron monitoring...');
monitor.registerCronTask('daily_backup', 'backup-001', 60000); // Every minute for demo

// Manually mark cron as triggered
monitor.recordCronTrigger('daily_backup', 'backup-001');

// 6. Get statistics
console.log('\n');
const stats = monitor.getStats();
console.log('Monitoring Statistics:');
console.log(`  Total Events: ${stats.totalEvents}`);
console.log(`  Total Alerts: ${stats.totalAlerts}`);
console.log(`  Uptime: ${stats.uptimeSeconds}s`);

// 7. Show recent alerts
const recentAlerts = monitor.getRecentAlerts(5);
console.log(`\nRecent Alerts (${recentAlerts.length}):`);
for (const alert of recentAlerts) {
  const emoji = alert.severity === 'critical' ? '🔴' :
                alert.severity === 'high' ? '🟠' :
                alert.severity === 'medium' ? '🟡' : '🔵';
  console.log(`  ${emoji} [${alert.type}] ${alert.message.substring(0, 60)}...`);
}

// Cleanup
monitor.stop();
console.log('\nExample completed.');
