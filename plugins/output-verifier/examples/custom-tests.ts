/**
 * Example: Custom E2E Tests
 * Demonstrates how to add custom verification tests
 */

import { OutputVerifier, E2eVerifier, loadConfig } from '../src';

async function main() {
  const config = loadConfig();
  config.verifiers.e2e = { enabled: true };
  const verifier = new OutputVerifier(config);

  console.log('=== Built-in E2E Tests ===\n');

  // Built-in tests run automatically
  const report1 = await verifier.verify({
    id: 'claim-1',
    timestamp: new Date(),
    description: 'Created user account',
    output: { userId: 42, status: 'active' },
    toolCalls: [
      { tool: 'create_user', result: { id: 42 } },
    ],
  });
  console.log(report1.summary);

  console.log('\n=== Custom Tests ===\n');

  // Get the E2E verifier and add custom tests
  // Note: In production, you'd configure this before creating OutputVerifier
  const e2eVerifier = new E2eVerifier({ enabled: true });

  // Add a custom test: output must have userId
  e2eVerifier.addTest('has_user_id', {
    description: 'Output must contain a userId field',
    assert: (claim) => {
      const hasId = claim.output && typeof claim.output === 'object' && 'userId' in (claim.output as object);
      return {
        passed: !!hasId,
        message: hasId ? 'Output contains userId' : 'Output is missing userId',
        expected: 'userId field present',
        actual: hasId ? 'found' : 'missing',
      };
    },
  });

  // Add a veto test: output must not contain errors
  e2eVerifier.addTest('no_errors', {
    description: 'Output must not contain error messages',
    veto: true, // This test failing will force overall status to 'failed'
    assert: (claim) => {
      if (typeof claim.output === 'string' && claim.output.includes('Error')) {
        return { passed: false, message: 'Output contains error text' };
      }
      return { passed: true, message: 'No errors found' };
    },
  });

  // Test with good output
  const r1 = await e2eVerifier.verify({
    id: 'good', timestamp: new Date(), description: 'Test',
    output: { userId: 42, name: 'Alice' },
  });
  console.log('Good output:', r1.status, r1.score + '/100');

  // Test with bad output (missing userId)
  const r2 = await e2eVerifier.verify({
    id: 'bad', timestamp: new Date(), description: 'Test',
    output: { name: 'Alice' },
  });
  console.log('Missing userId:', r2.status, r2.score + '/100');

  // Test with error output (veto should fail it)
  const r3 = await e2eVerifier.verify({
    id: 'error', timestamp: new Date(), description: 'Test',
    output: 'Error: database connection failed',
  });
  console.log('Error output:', r3.status, r3.score + '/100', r3.message.includes('VETO') ? '[VETOED]' : '');

  verifier.stop();
}

main().catch(console.error);
