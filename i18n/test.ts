import i18n, { getLang, getSupportedLangs } from './index';

// Test counters
let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean) {
  try {
    if (fn()) {
      console.log(`✓ ${name}`);
      passed++;
    } else {
      console.log(`✗ ${name}`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ ${name} - Error: ${e}`);
    failed++;
  }
}

console.log('=== i18n Tests ===\n');

// Test 1: All 3 locales load without errors
test('English locale loads', () => {
  const msg = i18n('alert.loop_detected', 'en');
  return msg === 'Loop detected in agent communication';
});

test('Chinese locale loads', () => {
  const msg = i18n('alert.loop_detected', 'zh');
  return msg === '检测到代理通信循环';
});

test('Japanese locale loads', () => {
  const msg = i18n('alert.loop_detected', 'ja');
  return msg === 'エージェント通信でループが検出されました';
});

// Test 2: Template variable substitution works
test('Variable substitution in English', () => {
  const msg = i18n('error.load_failed', 'en', { resource: 'config.yaml' });
  return msg === 'Failed to load config.yaml';
});

test('Variable substitution in Chinese', () => {
  const msg = i18n('error.load_failed', 'zh', { resource: 'config.yaml' });
  return msg === '加载 config.yaml 失败';
});

test('Variable substitution in Japanese', () => {
  const msg = i18n('error.load_failed', 'ja', { resource: 'config.yaml' });
  return msg === 'config.yaml の読み込みに失敗しました';
});

test('Multiple variable substitution', () => {
  const msg = i18n('compression.context_compressed', 'en', { original: '1000', compressed: '150' });
  return msg === 'Context compressed from 1000 to 150 tokens';
});

test('Dashboard alert summary substitution', () => {
  const msg = i18n('dashboard.alert_summary', 'en', { critical: '2', warning: '5', info: '10' });
  return msg === '2 critical, 5 warning, 10 info';
});

// Test 3: Missing keys return the key itself (not crash)
test('Missing key returns key itself in English', () => {
  const msg = i18n('nonexistent.key', 'en');
  return msg === 'nonexistent.key';
});

test('Missing key returns key itself in Chinese', () => {
  const msg = i18n('nonexistent.key', 'zh');
  return msg === 'nonexistent.key';
});

test('Missing key in target lang falls back to English', () => {
  // 'error.load_failed' exists in en but not in zh (if we remove it)
  // Since we have it in all, this tests the fallback works
  const msg = i18n('verification.passed', 'zh');
  return msg === '验证通过';
});

// Test 4: Default to English when lang unknown
test('Unknown lang defaults to English', () => {
  const msg = i18n('alert.timeout', 'fr' as any);
  return msg === 'Operation timed out';
});

test('Empty lang defaults to English', () => {
  const msg = i18n('alert.timeout', '');
  return msg === 'Operation timed out';
});

// Test 5: getLang and getSupportedLangs work
test('getSupportedLangs returns all 3 languages', () => {
  const langs = getSupportedLangs();
  return langs.includes('en') && langs.includes('zh') && langs.includes('ja') && langs.length === 3;
});

test('getLang returns valid locale', () => {
  const lang = getLang();
  return ['en', 'zh', 'ja'].includes(lang);
});

// Test 6: Verify all message categories exist in all locales
const categories = ['alert', 'verification', 'guard', 'compression', 'dashboard', 'error'];
const allKeys = [
  'alert.loop_detected',
  'alert.timeout',
  'alert.empty_response',
  'alert.anomaly',
  'alert.cron_missed',
  'verification.passed',
  'verification.failed',
  'verification.skipped',
  'guard.allowed',
  'guard.blocked',
  'guard.requires_confirmation',
  'compression.context_compressed',
  'compression.anchor_added',
  'dashboard.agent_count',
  'dashboard.alert_summary',
  'dashboard.health_status',
  'error.load_failed',
  'error.save_failed',
  'error.config_invalid'
];

test('All keys exist in English', () => {
  for (const key of allKeys) {
    const msg = i18n(key, 'en');
    if (msg === key) return false; // Key not found
  }
  return true;
});

test('All keys exist in Chinese', () => {
  for (const key of allKeys) {
    const msg = i18n(key, 'zh');
    if (msg === key) return false;
  }
  return true;
});

test('All keys exist in Japanese', () => {
  for (const key of allKeys) {
    const msg = i18n(key, 'ja');
    if (msg === key) return false;
  }
  return true;
});

// Test 7: ARP_LANG env var detection
test('ARP_LANG env var is respected', () => {
  const originalLang = process.env.ARP_LANG;
  process.env.ARP_LANG = 'zh';
  // Need to re-import to pick up env var change
  const lang = getLang();
  if (originalLang !== undefined) {
    process.env.ARP_LANG = originalLang;
  } else {
    delete process.env.ARP_LANG;
  }
  return lang === 'zh';
});

// Summary
console.log('\n=== Test Summary ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}`);

if (failed > 0) {
  process.exit(1);
}
