/**
 * Example: Basic Usage
 * Demonstrates how to use OutputVerifier to verify agent claims
 */

import { OutputVerifier, loadConfig } from '../src';

async function main() {
  // Initialize verifier with default config
  const config = loadConfig();
  const verifier = new OutputVerifier(config);

  console.log('=== Basic Output Verification ===\n');

  // Verify a simple output
  const result = await verifier.verifyOutput(
    { name: 'Alice', age: 30, email: 'alice@test.com' },
    {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
        email: { type: 'string' },
      },
      required: ['name', 'email'],
    }
  );

  console.log('Status:', result.status);
  console.log('Score:', result.score);
  console.log('Details:', result.details.map(d => `${d.field}: ${d.passed ? '✅' : '❌'}`).join(', '));

  console.log('\n=== Full Claim Verification ===\n');

  // Verify a complete agent claim
  const report = await verifier.verify({
    id: 'claim-1',
    timestamp: new Date(),
    description: 'Agent claims it created a user and sent a welcome email',
    output: { userId: 42, name: 'Bob', emailSent: true },
    toolCalls: [
      { tool: 'create_user', args: { name: 'Bob' }, result: { id: 42 }, duration: 120 },
      { tool: 'send_email', args: { to: 'bob@test.com' }, result: { sent: true }, duration: 200 },
    ],
  });

  console.log('Overall:', report.overallStatus);
  console.log('Score:', report.overallScore);
  console.log('Summary:', report.summary);

  verifier.stop();
}

main().catch(console.error);
