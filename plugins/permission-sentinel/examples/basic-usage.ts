/**
 * Example: Permission Sentinel Basic Usage
 */

import { PermissionSentinel, loadConfig } from '../src';

async function main() {
  const sentinel = new PermissionSentinel(loadConfig());

  console.log('=== 1. Command Checking ===\n');

  const commands = [
    'ls -la',
    'rm -rf /',
    'chmod 777 /var/www',
    'curl https://api.example.com/data',
    'sudo apt install nginx',
    'DROP TABLE users',
    'cat /etc/passwd',
  ];

  for (const cmd of commands) {
    const result = sentinel.checkCommand(cmd);
    const icon = result.riskLevel === 'safe' ? '✅' :
                 result.riskLevel === 'critical' ? '🔴' :
                 result.riskLevel === 'high' ? '🟠' : '🟡';
    console.log(`${icon} "${cmd}"`);
    console.log(`   Risk: ${result.riskLevel} | Allowed: ${result.allowed} | Confirm: ${result.requiresConfirmation}`);
    if (result.safeAlternative) {
      console.log(`   💡 ${result.safeAlternative}`);
    }
    console.log();
  }

  console.log('=== 2. Sensitive Data Sanitization ===\n');

  const sensitiveText = `
    User: alice@example.com
    Phone: 13812345678
    API Key: sk-abcdefghij1234567890abcdef
    Password: password=supersecret123
    Server: 192.168.1.100
  `;

  const sanitized = sentinel.sanitize(sensitiveText);
  console.log('Original:', sensitiveText.trim());
  console.log('\nSanitized:', sanitized.sanitized.trim());
  console.log('\nMatches found:', sanitized.matches.length);
  for (const m of sanitized.matches) {
    console.log(`  ${m.type}: "${m.original}" → "${m.replacement}"`);
  }

  console.log('\n=== 3. Stats ===\n');
  console.log(JSON.stringify(sentinel.getStats(), null, 2));

  sentinel.stop();
}

main().catch(console.error);
