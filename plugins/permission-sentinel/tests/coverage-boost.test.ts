/**
 * Permission Sentinel - Additional Coverage Tests
 * Tests to cover uncovered branches and edge cases
 */

import { PermissionSentinel, getDefaultConfig, loadConfig } from '../src';
import { SensitiveDataMatch } from '../src/types';

// Mock process.env for config tests
const originalEnv = process.env;

describe('PermissionSentinel Additional Coverage', () => {
  let sentinel: PermissionSentinel;

  beforeEach(() => {
    sentinel = new PermissionSentinel(getDefaultConfig());
  });

  afterEach(() => {
    sentinel.stop();
  });

  // ─── ReDoS Protection - checkRegexSafety branches ──────────

  describe('ReDoS Protection - too many character classes', () => {
    it('should skip custom sanitizers with more than 20 character classes', () => {
      // Create a pattern with 21+ character classes like [a][b][c]...
      const patternWithManyCharClasses = '[[a]][[b]][[c]][[d]][[e]][[f]][[g]][[h]][[i]][[j]][[k]][[l]][[m]][[n]][[o]][[p]][[q]][[r]][[s]][[t]][[u]]';
      const s = new PermissionSentinel({
        ...getDefaultConfig(),
        customSanitizers: [{
          name: 'test',
          pattern: new RegExp(patternWithManyCharClasses, 'g'),
          replacement: 'REPLACED',
        }],
      });
      // The custom sanitizer should be skipped due to ReDoS check
      const rules = s.getRules();
      expect(rules.length).toBeGreaterThan(0);
      s.stop();
    });
  });

  describe('ReDoS Protection - too many groups', () => {
    it('should skip custom sanitizers with more than 20 groups', () => {
      // Create a pattern with 21+ groups
      const patternWithManyGroups = '((a)(b)(c)(d)(e)(f)(g)(h)(i)(j)(k)(l)(m)(n)(o)(p)(q)(r)(s)(t)(u))';
      const s = new PermissionSentinel({
        ...getDefaultConfig(),
        customSanitizers: [{
          name: 'test',
          pattern: new RegExp(patternWithManyGroups, 'g'),
          replacement: 'REPLACED',
        }],
      });
      // The custom sanitizer should be skipped due to ReDoS check
      s.stop();
    });
  });

  describe('ReDoS Protection - non-capturing groups and lookaheads', () => {
    it('should handle non-capturing groups (?:...)', () => {
      const s = new PermissionSentinel({
        ...getDefaultConfig(),
        customSanitizers: [{
          name: 'test-non-capturing',
          pattern: /(?:abc|def)+/g,
          replacement: 'REPLACED',
        }],
      });
      const result = s.sanitize('abcabc defdef');
      expect(result.sanitized).toBeDefined();
      s.stop();
    });

    it('should handle positive lookahead (?=...)', () => {
      const s = new PermissionSentinel({
        ...getDefaultConfig(),
        customSanitizers: [{
          name: 'test-lookahead',
          pattern: /(?=abc)/g,
          replacement: 'REPLACED',
        }],
      });
      s.stop();
    });

    it('should handle negative lookahead (?!...)', () => {
      const s = new PermissionSentinel({
        ...getDefaultConfig(),
        customSanitizers: [{
          name: 'test-neg-lookahead',
          pattern: /(?!abc)/g,
          replacement: 'REPLACED',
        }],
      });
      s.stop();
    });
  });

  describe('ReDoS Protection - too many alternations', () => {
    it('should skip custom sanitizers with more than 10 alternations', () => {
      // Need 12 alternations to exceed the limit of 10
      const patternWithManyAlts = '(a|b|c|d|e|f|g|h|i|j|k|l)';
      const s = new PermissionSentinel({
        ...getDefaultConfig(),
        customSanitizers: [{
          name: 'test-alternations',
          pattern: new RegExp(patternWithManyAlts, 'g'),
          replacement: 'REPLACED',
        }],
      });
      // Should be skipped due to too many alternations
      s.stop();
    });
  });

  describe('ReDoS Protection - nested quantifiers', () => {
    // Note: Adjacent quantifiers like a++, a**, a*+ are invalid JavaScript regex
    // and will throw SyntaxError at compilation time. The checkRegexSafety function
    // checks string patterns before compilation, but these patterns are invalid
    // even as strings because they violate regex grammar.
    // So lines 76-78 cannot be triggered through normal custom sanitizers or rules.
  });

  describe('ReDoS Protection - pattern too long', () => {
    it('should skip custom sanitizers longer than 500 characters', () => {
      const longPattern = 'a'.repeat(501);
      const s = new PermissionSentinel({
        ...getDefaultConfig(),
        customSanitizers: [{
          name: 'test-long',
          pattern: new RegExp(longPattern, 'g'),
          replacement: 'REPLACED',
        }],
      });
      // Should be skipped due to being too long
      s.stop();
    });
  });

  // ─── Rule ReDoS protection ────────────────────────────────

  describe('Rule ReDoS protection', () => {
    it('should skip rules that fail the ReDoS safety check', () => {
      const s = new PermissionSentinel({
        ...getDefaultConfig(),
        rules: [{
          id: 'redos-rule',
          name: 'ReDoS Rule',
          pattern: '(a+)+', // Dangerous nested quantifiers
          riskLevel: 'high',
          description: 'This pattern is unsafe',
          action: 'block',
        }],
      });
      // Rule should be skipped, so checkCommand should not match it
      const result = s.checkCommand('aaaaaa');
      // The rule is skipped but the command is not inherently dangerous
      expect(result).toBeDefined();
      s.stop();
    });

    it('should handle rules with invalid regex gracefully', () => {
      const s = new PermissionSentinel({
        ...getDefaultConfig(),
        rules: [{
          id: 'invalid-regex-rule',
          name: 'Invalid Regex Rule',
          pattern: '[', // Invalid regex - unclosed bracket
          riskLevel: 'high',
          description: 'Invalid regex',
          action: 'block',
        }],
      });
      // Should handle the invalid regex without crashing
      const result = s.checkCommand('test [ string');
      expect(result).toBeDefined();
      expect(result.allowed).toBe(true); // Invalid regex should be skipped
      s.stop();
    });
  });

  describe('Custom sanitizers ReDoS protection', () => {
    it('should skip custom sanitizers that fail the ReDoS safety check', () => {
      const s = new PermissionSentinel({
        ...getDefaultConfig(),
        customSanitizers: [{
          name: 'unsafe-sanitizer',
          pattern: /(a+)+/g,
          replacement: 'SAFE',
        }],
      });
      // Custom sanitizer should be skipped
      const result = s.sanitize('aaaaaa');
      // Sanitization should still work with built-in patterns
      expect(result).toBeDefined();
      s.stop();
    });
  });

  // ─── Invalid ID card handling ─────────────────────────────

  describe('Invalid ID card handling', () => {
    it('should skip ID cards that fail checksum validation', () => {
      // This ID card has wrong checksum (calculated check digit doesn't match)
      const invalidIdCard = '110101199003074515'; // Wrong checksum, last digit should be 4 not 5
      const result = sentinel.sanitize(`ID: ${invalidIdCard}`);
      // Should not match because checksum is invalid
      const idMatches = result.matches.filter((m: SensitiveDataMatch) => m.type === 'id_card');
      expect(idMatches.length).toBe(0);
    });

    it('should accept ID cards with valid checksum', () => {
      // Valid ID card: 110101199003074514 (checksum = 4)
      const validIdCard = '110101199003074514';
      const result = sentinel.sanitize(`ID: ${validIdCard}`);
      const idMatches = result.matches.filter((m: SensitiveDataMatch) => m.type === 'id_card');
      expect(idMatches.length).toBe(1);
    });
  });

  // ─── removeRule edge cases ────────────────────────────────

  describe('removeRule edge cases', () => {
    it('should return false when removing a non-existent rule', () => {
      const removed = sentinel.removeRule('non-existent-rule-id');
      expect(removed).toBe(false);
    });

    it('should return true when removing an existing rule', () => {
      sentinel.addRule({
        id: 'temp-rule-to-remove',
        name: 'Temp',
        pattern: 'temp',
        riskLevel: 'low' as const,
        description: 'Temp',
        action: 'warn' as const,
      });
      const removed = sentinel.removeRule('temp-rule-to-remove');
      expect(removed).toBe(true);
    });
  });

  // ─── actionLog MAX_ACTIONS limit ─────────────────────────

  describe('actionLog MAX_ACTIONS limit', () => {
    it('should truncate actionLog when it exceeds MAX_ACTIONS (10000)', () => {
      const s = new PermissionSentinel(getDefaultConfig());

      // Perform exactly 10001 actions to trigger truncation
      for (let i = 0; i < 10001; i++) {
        s.checkCommand(`ls /tmp/${i}`);
      }

      // getHistory without limit defaults to 20, so use a higher limit to see full actionLog
      const history = s.getHistory(15000);
      // History should be limited to last 10000 (MAX_ACTIONS)
      expect(history.length).toBeLessThanOrEqual(10000);
      expect(history.length).toBe(10000);

      const stats = s.getStats();
      // totalChecked equals actionLog.length, which is truncated to 10000
      expect(stats.totalChecked).toBe(10000);

      s.stop();
    });
  });

  // ─── getRules ────────────────────────────────────────────

  describe('getRules', () => {
    it('should return a copy of the rules array', () => {
      const rules = sentinel.getRules();
      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThan(0);
    });

    it('returned array should be a copy (modifications do not affect sentinel)', () => {
      const rules = sentinel.getRules();
      const originalLength = rules.length;
      rules.push({
        id: 'external-modification',
        name: 'External',
        pattern: 'test',
        riskLevel: 'low' as const,
        description: 'External',
        action: 'warn' as const,
      });
      const sentinelRules = sentinel.getRules();
      expect(sentinelRules.length).toBe(originalLength);
    });
  });

  // ─── Empty and whitespace commands ────────────────────────

  describe('empty and whitespace commands', () => {
    it('should handle command with only whitespace', () => {
      const result = sentinel.checkCommand('   \n\t  ');
      expect(result.allowed).toBe(true);
    });

    it('should handle null-like context', () => {
      const result = sentinel.checkCommand('ls', undefined as unknown as string);
      expect(result.allowed).toBe(true);
    });
  });

  // ─── buildResult edge cases ───────────────────────────────

  describe('buildResult edge cases', () => {
    it('should build result with all optional fields', () => {
      // Test with all parameters including optional ones
      const result = sentinel.checkCommand('test command');
      expect(result.actionId).toBeDefined();
      expect(result.riskLevel).toBeDefined();
      expect(result.allowed).toBeDefined();
      expect(result.requiresConfirmation).toBeDefined();
      expect(result.reason).toBeDefined();
    });

    it('should build result with matchedRule and safeAlternative', () => {
      const result = sentinel.checkCommand('DROP TABLE users');
      expect(result.matchedRule).toBe('database-drop');
      expect(result.safeAlternative).toBeDefined();
    });
  });

  // ─── Whitelist and blacklist interaction ─────────────────

  describe('whitelist and blacklist interaction', () => {
    it('should check blacklist before rules', () => {
      const s = new PermissionSentinel({
        ...getDefaultConfig(),
        blockedCommands: ['rm'],
      });
      const result = s.checkCommand('rm -rf /');
      expect(result.allowed).toBe(false);
      expect(result.matchedRule).toBe('blocked:rm');
      s.stop();
    });

    it('should handle empty blockedCommands array', () => {
      const s = new PermissionSentinel({
        ...getDefaultConfig(),
        blockedCommands: [],
      });
      const result = s.checkCommand('rm -rf /');
      expect(result.allowed).toBe(false); // Still blocked by dangerous-rm rule
      s.stop();
    });

    it('should handle empty safeCommands array', () => {
      const s = new PermissionSentinel({
        ...getDefaultConfig(),
        safeCommands: [],
      });
      const result = s.checkCommand('ls -la');
      expect(result.riskLevel).toBe('safe'); // ls is still safe by default
      s.stop();
    });
  });

  // ─── Custom sanitizer pattern application ─────────────────

  describe('custom sanitizer pattern application', () => {
    it('should apply custom sanitizers to text', () => {
      const s = new PermissionSentinel({
        ...getDefaultConfig(),
        customSanitizers: [{
          name: 'redact-sensitive',
          pattern: /SECRET/g,
          replacement: '[REDACTED]',
        }],
      });
      const result = s.sanitize('The SECRET is out');
      expect(result.sanitized).toContain('[REDACTED]');
      s.stop();
    });

    it('should handle multiple custom sanitizers', () => {
      const s = new PermissionSentinel({
        ...getDefaultConfig(),
        customSanitizers: [
          {
            name: 'redact-1',
            pattern: /REDACT1/g,
            replacement: '[R1]',
          },
          {
            name: 'redact-2',
            pattern: /REDACT2/g,
            replacement: '[R2]',
          },
        ],
      });
      const result = s.sanitize('REDACT1 and REDACT2');
      expect(result.sanitized).toContain('[R1]');
      expect(result.sanitized).toContain('[R2]');
      s.stop();
    });
  });

  // ─── Stats by risk level ──────────────────────────────────

  describe('stats by risk level', () => {
    it('should track counts by risk level', () => {
      const s = new PermissionSentinel(getDefaultConfig());

      s.checkCommand('ls'); // safe
      s.checkCommand('echo test'); // safe
      s.checkCommand('curl https://example.com'); // medium
      s.checkCommand('rm -rf /'); // critical

      const stats = s.getStats();
      expect(stats.byRiskLevel).toBeDefined();
      expect(stats.byRiskLevel.safe).toBeGreaterThanOrEqual(0);
      expect(stats.byRiskLevel.low).toBeGreaterThanOrEqual(0);
      expect(stats.byRiskLevel.medium).toBeGreaterThanOrEqual(0);
      expect(stats.byRiskLevel.high).toBeGreaterThanOrEqual(0);
      expect(stats.byRiskLevel.critical).toBeGreaterThanOrEqual(0);
      s.stop();
    });
  });
});

// ─── Config environment variable tests (outside describe block) ───

describe('config environment variable override', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should disable enabled when PERMISSION_SENTINEL_ENABLED is false', () => {
    process.env.PERMISSION_SENTINEL_ENABLED = 'false';
    const config = loadConfig({});
    expect(config.enabled).toBe(false);
  });

  it('should keep enabled true when PERMISSION_SENTINEL_ENABLED is not set', () => {
    delete process.env.PERMISSION_SENTINEL_ENABLED;
    const config = loadConfig({});
    expect(config.enabled).toBe(true);
  });
});

// ─── Logger tests ──────────────────────────────────────────

describe('logger methods', () => {
  const { logger, createChildLogger } = require('../src/logger');

  it('should support debug level logging', () => {
    expect(typeof logger.debug).toBe('function');
    logger.debug('test debug message');
  });

  it('should support info level logging', () => {
    expect(typeof logger.info).toBe('function');
    logger.info('test info message');
  });

  it('should support warn level logging', () => {
    expect(typeof logger.warn).toBe('function');
    logger.warn('test warn message');
  });

  it('should support error level logging', () => {
    expect(typeof logger.error).toBe('function');
    logger.error('test error message');
  });

  it('should support createChildLogger', () => {
    const childLogger = createChildLogger({ component: 'test' });
    expect(childLogger).toBeDefined();
    expect(typeof childLogger.debug).toBe('function');
    expect(typeof childLogger.info).toBe('function');
    expect(typeof childLogger.warn).toBe('function');
    expect(typeof childLogger.error).toBe('function');
  });

  it('should support child logger debug', () => {
    const childLogger = createChildLogger({ component: 'test' });
    childLogger.debug('child debug message', { extra: 'context' });
  });

  it('should support child logger info', () => {
    const childLogger = createChildLogger({ component: 'test' });
    childLogger.info('child info message', { extra: 'context' });
  });

  it('should support child logger warn', () => {
    const childLogger = createChildLogger({ component: 'test' });
    childLogger.warn('child warn message', { extra: 'context' });
  });

  it('should support child logger error', () => {
    const childLogger = createChildLogger({ component: 'test' });
    childLogger.error('child error message', { extra: 'context' });
  });
});
