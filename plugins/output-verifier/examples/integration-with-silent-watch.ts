/**
 * Example: Integration with SilentWatch
 * Shows how OutputVerifier and SilentWatch work together
 *
 * Prerequisites:
 *   npm install silent-watch output-verifier
 */

// In production, import from the packages:
// import { SilentWatchMonitor, loadConfig as loadSWConfig } from 'silent-watch';
// import { OutputVerifier, loadConfig as loadOVConfig } from 'output-verifier';

// For this example, we simulate the integration
import { OutputVerifier, loadConfig } from '../src';

async function main() {
  console.log('=== SilentWatch + OutputVerifier Integration ===\n');

  const verifier = new OutputVerifier(loadConfig());

  // Simulate: SilentWatch detects agent claims completion
  // In real usage, this callback would be triggered by SilentWatch's onAlert
  async function onAgentClaimComplete(claim: {
    description: string;
    output: unknown;
    toolCalls: Array<{ tool: string; result?: unknown; duration?: number }>;
  }) {
    console.log(`Agent claims: "${claim.description}"`);

    // Run OutputVerifier on the claim
    const report = await verifier.verify({
      id: `claim-${Date.now()}`,
      timestamp: new Date(),
      description: claim.description,
      output: claim.output,
      toolCalls: claim.toolCalls,
    });

    console.log(`Verification: ${report.summary}`);

    if (report.overallStatus === 'failed') {
      console.log('❌ Agent claim FAILED verification - notifying user');
      // In real usage: send alert via SilentWatch's notification channels
    } else if (report.overallStatus === 'partial') {
      console.log('⚠️ Agent claim PARTIALLY verified - may need manual review');
    } else {
      console.log('✅ Agent claim verified successfully');
    }

    return report;
  }

  // Scenario 1: Agent claims to have created a user
  await onAgentClaimComplete({
    description: '创建了新用户 Alice',
    output: { userId: 42, name: 'Alice', email: 'alice@test.com' },
    toolCalls: [
      { tool: 'create_user', result: { id: 42 }, duration: 120 },
      { tool: 'send_welcome_email', result: { sent: true }, duration: 200 },
    ],
  });

  console.log();

  // Scenario 2: Agent claims success but output is empty
  await onAgentClaimComplete({
    description: '更新了用户资料',
    output: '',
    toolCalls: [
      { tool: 'update_user', result: null },
    ],
  });

  console.log();

  // Scenario 3: Agent claims success but tool had no result
  await onAgentClaimComplete({
    description: '发送了通知邮件',
    output: { emailSent: true },
    toolCalls: [
      { tool: 'send_email', args: { to: 'user@test.com' } }, // No result!
    ],
  });

  console.log('\n=== Integration Stats ===');
  console.log(JSON.stringify(verifier.getStats()));

  verifier.stop();
}

main().catch(console.error);
