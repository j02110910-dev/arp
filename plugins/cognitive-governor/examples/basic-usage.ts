/**
 * Example: Cognitive Governor Basic Usage
 */

import { CognitiveGovernor, loadConfig } from '../src';

async function main() {
  const governor = new CognitiveGovernor(loadConfig());

  console.log('=== 1. Context Compression ===\n');

  // Simulate a long conversation
  const messages = [];
  for (let i = 0; i < 50; i++) {
    messages.push({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i}: Building the authentication system with JWT tokens and refresh flow.`,
    });
  }

  const result = governor.compressContext(messages);
  console.log(`Compressed: ${messages.length} → ${result.compressed.length} messages`);
  console.log(`Tokens saved: ${result.summary.tokensSaved}`);
  console.log(`Topics: ${result.summary.preservedTopics.join(', ')}`);

  console.log('\n=== 2. Anchor Management ===\n');

  // Add critical instructions that should always be in the prompt
  governor.addAnchor('Complete the user registration flow', 10, ['task']);
  governor.addAnchor('Never expose passwords in logs', 8, ['security']);
  governor.addAnchor('Use TypeScript strict mode', 5, ['code-quality']);

  console.log('Active anchors:', governor.getActiveAnchors().length);
  console.log('Injection text:', governor.generateAnchorInjection());

  console.log('\n=== 3. Knowledge Base ===\n');

  // Store knowledge from solved problems
  governor.storeKnowledge(
    'JWT token refresh not working after expiry',
    'Add refresh token rotation and blacklist old tokens',
    ['auth', 'jwt']
  );
  governor.storeKnowledge(
    'PostgreSQL connection pool exhaustion',
    'Set max connections and implement connection timeout',
    ['database', 'postgresql']
  );

  // Search for relevant knowledge later
  const results = governor.searchKnowledge({ text: 'token refresh', limit: 3 });
  console.log('Found', results.length, 'relevant entries');
  for (const r of results) {
    console.log(`  [${r.relevanceScore.toFixed(2)}] ${r.problem}`);
    console.log(`  → ${r.solution}`);
  }

  console.log('\n=== 4. Health Check ===\n');
  const health = governor.getHealth(messages);
  console.log(`Status: ${health.status}`);
  console.log(`Tokens: ${health.totalTokens}/${health.tokenLimit} (${health.usagePercent}%)`);
  console.log(`Anchors: ${health.activeAnchors}`);
  console.log(`Knowledge: ${health.knowledgeEntries}`);

  governor.stop();
}

main().catch(console.error);
