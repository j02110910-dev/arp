/**
 * Permission Sentinel - Main Class
 * Security firewall that checks agent actions and sanitizes sensitive data
 */

import { v4 as uuidv4 } from 'uuid';
import {
  PermissionSentinelConfig,
  SecurityAction,
  SecurityResult,
  SecurityRule,
  SanitizationResult,
  SensitiveDataMatch,
  RiskLevel,
} from './types';
import { logger } from './logger';

// ─── ReDoS Protection ─────────────────────────────────────────

/**
 * Check if a regex pattern is potentially vulnerable to ReDoS.
 * Returns { safe: true } if the pattern is safe to execute.
 * Returns { safe: false, reason: string } if the pattern is potentially dangerous.
 */
function checkRegexSafety(pattern: string): { safe: boolean; reason?: string } {
  // Pattern complexity limits
  const MAX_ALTERNATIONS = 10;
  const MAX_NESTED_QUANTIFIERS = 2;
  const MAX_CHAR_CLASSES = 20;
  const MAX_GROUPS = 20;

  let alternationCount = 0;
  let nestedQuantifierDepth = 0;
  let charClassCount = 0;
  let groupCount = 0;
  let inCharClass = false;

  // Patterns that indicate potential ReDoS: nested quantifiers with overlapping alternatives
  // e.g., (a+)+, (a*)*, (a+)*, (a|b)+b
  // We skip the aggressive dangerousPatterns check since it produces false positives with char classes
  // The token-by-token analysis below is more precise

  // Token-by-token analysis
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    const nextCh = pattern[i + 1];

    if (ch === '[') {
      inCharClass = true;
      charClassCount++;
      if (charClassCount > MAX_CHAR_CLASSES) {
        return { safe: false, reason: `Too many character classes (limit: ${MAX_CHAR_CLASSES})` };
      }
    } else if (ch === ']') {
      inCharClass = false;
    } else if (ch === '(') {
      groupCount++;
      if (groupCount > MAX_GROUPS) {
        return { safe: false, reason: `Too many groups (limit: ${MAX_GROUPS})` };
      }
      // Check for non-capturing group or lookahead
      if (pattern[i + 1] === '?') {
        i++; // skip the ?
        if (pattern[i + 1] === ':' || pattern[i + 1] === '=' || pattern[i + 1] === '!') {
          i++;
        }
      }
    } else if (ch === '|') {
      alternationCount++;
      if (alternationCount > MAX_ALTERNATIONS) {
        return { safe: false, reason: `Too many alternations (limit: ${MAX_ALTERNATIONS})` };
      }
    } else if ((ch === '+' || ch === '*') && !inCharClass) {
      // Check what follows the quantifier
      if (nextCh === '+' || nextCh === '*') {
        nestedQuantifierDepth++;
        if (nestedQuantifierDepth > MAX_NESTED_QUANTIFIERS) {
          return { safe: false, reason: `Nested quantifiers detected (limit: ${MAX_NESTED_QUANTIFIERS})` };
        }
      }
      // Check for quantifier followed by alternation or group end - common ReDoS pattern
      // e.g., (a+)+, (a*)*, (a+)|, (a*)|
      if (nextCh === '|' || nextCh === ')') {
        nestedQuantifierDepth++;
        if (nestedQuantifierDepth > MAX_NESTED_QUANTIFIERS) {
          return { safe: false, reason: `Quantifier with overlapping alternatives detected (limit: ${MAX_NESTED_QUANTIFIERS})` };
        }
      }
    }
  }

  // Additional heuristic: very long pattern (>500 chars) is suspicious
  if (pattern.length > 500) {
    return { safe: false, reason: `Pattern too long (${pattern.length} chars, limit: 500)` };
  }

  return { safe: true };
}

// Built-in dangerous command patterns
const BUILTIN_RULES: SecurityRule[] = [
  {
    id: 'dangerous-rm',
    name: 'Dangerous rm command',
    pattern: 'rm\\s+(-[rRf]*\\s+)*(/|\\*|\\.\\.|~)',
    riskLevel: 'critical',
    description: 'Recursive or force delete on root/home/multiple files',
    action: 'block',
    safeAlternative: 'Use specific file paths instead of wildcards',
  },
  {
    id: 'mass-delete',
    name: 'Mass file deletion',
    pattern: 'rm\\s+(-[rRf]+)\\s+\\.',
    riskLevel: 'critical',
    description: 'Recursive force delete on current directory',
    action: 'block',
  },
  {
    id: 'format-disk',
    name: 'Disk formatting',
    pattern: '(mkfs|fdisk|dd\\s+if=|format)[\\s.]',
    riskLevel: 'critical',
    description: 'Disk formatting or raw disk operations',
    action: 'block',
  },
  {
    id: 'chmod-777',
    name: 'Overly permissive permissions',
    pattern: 'chmod\\s+(-[rR]+\\s+)?777',
    riskLevel: 'high',
    description: 'Setting permissions to 777 (everyone can read/write/execute)',
    action: 'confirm',
    safeAlternative: 'Use more restrictive permissions like 755 or 644',
  },
  {
    id: 'pipe-to-shell',
    name: 'Pipe to shell execution',
    pattern: '(curl|wget).*\\|\\s*(sh|bash|zsh)',
    riskLevel: 'critical',
    description: 'Downloading and executing code directly',
    action: 'block',
  },
  {
    id: 'curl-wget-external',
    name: 'External network request',
    pattern: '(curl|wget)\\s+https?://',
    riskLevel: 'medium',
    description: 'HTTP request to external server',
    action: 'confirm',
  },
  {
    id: 'env-exfiltration',
    name: 'Environment variable leak',
    pattern: '(env|printenv|export|cat\\s+/proc/self/environ)',
    riskLevel: 'medium',
    description: 'Reading environment variables (may contain secrets)',
    action: 'confirm',
  },
  {
    id: 'ssh-key-access',
    name: 'SSH key access',
    pattern: 'cat\\s+~/.ssh/',
    riskLevel: 'high',
    description: 'Accessing SSH private keys',
    action: 'confirm',
  },
  {
    id: 'sudo-execution',
    name: 'Sudo command',
    pattern: 'sudo\\s+',
    riskLevel: 'high',
    description: 'Running command with root privileges',
    action: 'confirm',
  },
  {
    id: 'database-drop',
    name: 'Database drop',
    pattern: '(DROP\\s+TABLE|DROP\\s+DATABASE|TRUNCATE\\s+TABLE)',
    riskLevel: 'critical',
    description: 'Dropping database tables',
    action: 'block',
    safeAlternative: 'Use DELETE with WHERE clause instead',
  },
];

// Built-in sensitive data patterns
const SENSITIVE_PATTERNS: Array<{
  type: SensitiveDataMatch['type'];
  pattern: RegExp;
  replacement: string;
}> = [
  {
    type: 'phone',
    pattern: /1[3-9]\d{9}/g,
    replacement: '[PHONE_REDACTED]',
  },
  {
    type: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '[EMAIL_REDACTED]',
  },
  {
    type: 'id_card',
    pattern: /\d{17}[\dXx]/g,
    replacement: '[ID_REDACTED]',
  },
  {
    type: 'credit_card',
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: '[CARD_REDACTED]',
  },
  {
    type: 'api_key',
    pattern: /\b(sk-|ak-|api[_-]?key[=:]?\s*|private[_-]?key[=:]?\s*|ghp_|gho_|ghu_|ghs_|ghr_|AKIA[0-9A-Z]{16}|SG\.|key-|xox[baprs]-|secret[_-]|token[_-]|bearer\s+|eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*)[a-zA-Z0-9_.\\-]{10,}\b/gi,
    replacement: '[API_KEY_REDACTED]',
  },
  {
    type: 'password',
    pattern: /(password|passwd|pwd|secret)[=:\s]+\S+/gi,
    replacement: '$1=[REDACTED]',
  },
  {
    type: 'token',
    pattern: /\b(bearer\s+|token[=:\s]+)[a-zA-Z0-9._-]{20,}\b/gi,
    replacement: '$1[TOKEN_REDACTED]',
  },
  {
    type: 'ip_address',
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    replacement: '[IP_REDACTED]',
  },
];

// ─── Chinese ID Card Validation ─────────────────────────────────

/**
 * Validate Chinese ID card checksum (18-digit ID)
 * Returns true if the ID is valid (checksum passes), false otherwise.
 * This helps reduce false positives from the regex pattern.
 */
function validateChineseIdCard(id: string): boolean {
  if (!id || id.length !== 18) return false;

  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];

  const first17 = id.substring(0, 17);
  const lastChar = id.charAt(17).toUpperCase();

  // Check first 17 chars are all digits
  if (!/^\d{17}$/.test(first17)) return false;

  // Calculate weighted sum
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += parseInt(first17[i], 10) * weights[i];
  }

  // Get expected check code
  const expectedCode = checkCodes[sum % 11];

  return lastChar === expectedCode;
}

export class PermissionSentinel {
  private static readonly MAX_ACTIONS = 10000;
  private config: PermissionSentinelConfig;
  private rules: SecurityRule[] = [];
  private actionLog: SecurityResult[] = [];
  private customSanitizers: Array<{ name: string; pattern: RegExp; replacement: string }> = [];

  constructor(config: PermissionSentinelConfig) {
    this.config = config;
    this.setupRules();
    this.setupCustomSanitizers();
  }

  private setupRules(): void {
    // Add built-in rules
    this.rules = [...BUILTIN_RULES];

    // Add custom rules
    if (this.config.rules) {
      this.rules.push(...this.config.rules);
    }
  }

  private setupCustomSanitizers(): void {
    if (this.config.customSanitizers) {
      for (const s of this.config.customSanitizers) {
        // ReDoS protection: check regex complexity before storing
        const safety = checkRegexSafety(s.pattern.source);
        if (!safety.safe) {
          logger.warn(`Skipping custom sanitizer "${s.name}"`, { reason: safety.reason });
          continue;
        }
        this.customSanitizers.push({
          name: s.name,
          pattern: new RegExp(s.pattern.source, s.pattern.flags),
          replacement: s.replacement,
        });
      }
    }
  }

  // ─── Command/Action Checking ──────────────────────────────

  /**
   * Check if a command/action is safe
   */
  checkAction(action: SecurityAction): SecurityResult {
    const command = action.command.toLowerCase().trim();

    // Check whitelist first — set flag, don't return early
    let whitelistReason: string | undefined;
    if (this.config.safeCommands) {
      for (const safe of this.config.safeCommands) {
        if (command.startsWith(safe.toLowerCase())) {
          whitelistReason = `Whitelisted: ${safe}`;
          break;
        }
      }
    }

    // Check blacklist
    if (this.config.blockedCommands) {
      for (const blocked of this.config.blockedCommands) {
        if (new RegExp(`\\b${blocked.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(command)) {
          return this.buildResult(action.id, 'critical', false, false,
            `Blocked: "${blocked}" is in the blacklist`, `blocked:${blocked}`);
        }
      }
    }

    // Check rules
    for (const rule of this.rules) {
      try {
        // ReDoS protection: check regex complexity before compilation
        const safety = checkRegexSafety(rule.pattern);
        if (!safety.safe) {
          logger.warn(`Skipping rule "${rule.id}"`, { reason: safety.reason });
          continue;
        }
        const regex = new RegExp(rule.pattern, 'i');
        if (regex.test(action.command)) {
          // Whitelist overrides rule action - if whitelisted, allow regardless of rule
          if (whitelistReason) {
            return this.buildResult(
              action.id,
              rule.riskLevel,
              true, // allowed = true (whitelist overrides block)
              false, // no confirmation needed for whitelisted commands
              whitelistReason,
              undefined, // no matchedRule since whitelist overrides
              undefined
            );
          }
          const allowed = rule.action !== 'block';
          const needsConfirm = rule.action === 'confirm';
          return this.buildResult(
            action.id,
            rule.riskLevel,
            allowed,
            needsConfirm,
            rule.description,
            rule.id,
            rule.safeAlternative
          );
        }
      } catch (e) {
        logger.warn(`Skipping rule "${rule.id}" due to invalid regex`, { error: e instanceof Error ? e.message : String(e) });
      }
    }

    // No rule matched — safe by default; whitelist skips confirmation
    const needsConfirm = whitelistReason ? false : false;
    return this.buildResult(action.id, 'safe', true, needsConfirm,
      whitelistReason ?? 'No security concerns detected');
  }

  /**
   * Quick check: just check a command string
   */
  checkCommand(command: string, context?: string): SecurityResult {
    return this.checkAction({
      id: uuidv4(),
      type: 'command',
      command,
      timestamp: new Date(),
      context,
    });
  }

  // ─── Sensitive Data Sanitization ──────────────────────────

  /**
   * Sanitize text by replacing sensitive data with placeholders
   */
  sanitize(text: string): SanitizationResult {
    if (!this.config.enableSanitization) {
      return { original: text, sanitized: text, matches: [], wasModified: false };
    }

    let sanitized = text;
    const allMatches: SensitiveDataMatch[] = [];

    // Apply built-in patterns
    for (const sp of SENSITIVE_PATTERNS) {
      const matches = [...text.matchAll(sp.pattern)];
      for (const match of matches) {
        if (match.index !== undefined) {
          const matchedValue = match[0];
          // For ID cards, validate checksum to avoid false positives
          if (sp.type === 'id_card' && !validateChineseIdCard(matchedValue)) {
            continue; // Skip invalid ID card numbers
          }
          allMatches.push({
            type: sp.type,
            original: matchedValue,
            replacement: sp.replacement,
            position: { start: match.index, end: match.index + matchedValue.length },
          });
        }
      }
      sanitized = sanitized.replace(sp.pattern, sp.replacement);
    }

    // Apply custom sanitizers
    for (const cs of this.customSanitizers) {
      sanitized = sanitized.replace(cs.pattern, cs.replacement);
    }

    return {
      original: text,
      sanitized,
      matches: allMatches,
      wasModified: sanitized !== text,
    };
  }

  /**
   * Restore sanitized text (reverse the sanitization)
   * Note: This only works if the original values are provided
   */
  restore(sanitized: string, originalValues: Map<string, string>): string {
    let restored = sanitized;
    for (const [placeholder, original] of originalValues) {
      restored = restored.replace(new RegExp(placeholder, 'g'), original);
    }
    return restored;
  }

  // ─── Stats & History ─────────────────────────────────────

  /**
   * Get action check history
   */
  getHistory(limit = 20): SecurityResult[] {
    return this.actionLog.slice(-limit);
  }

  /**
   * Get security stats
   */
  getStats(): {
    totalChecked: number;
    safe: number;
    blocked: number;
    warned: number;
    needsConfirmation: number;
    byRiskLevel: Record<RiskLevel, number>;
  } {
    const byRiskLevel: Record<RiskLevel, number> = {
      safe: 0, low: 0, medium: 0, high: 0, critical: 0,
    };
    let blocked = 0;
    let needsConfirm = 0;

    for (const r of this.actionLog) {
      byRiskLevel[r.riskLevel]++;
      if (!r.allowed) blocked++;
      if (r.requiresConfirmation) needsConfirm++;
    }

    return {
      totalChecked: this.actionLog.length,
      safe: byRiskLevel.safe + byRiskLevel.low,
      blocked,
      warned: byRiskLevel.medium + byRiskLevel.high,
      needsConfirmation: needsConfirm,
      byRiskLevel,
    };
  }

  /**
   * Add a custom security rule
   */
  addRule(rule: SecurityRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove a rule by ID
   */
  removeRule(id: string): boolean {
    const index = this.rules.findIndex(r => r.id === id);
    if (index >= 0) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all active rules
   */
  getRules(): SecurityRule[] {
    return [...this.rules];
  }

  private buildResult(
    actionId: string,
    riskLevel: RiskLevel,
    allowed: boolean,
    requiresConfirmation: boolean,
    reason: string,
    matchedRule?: string,
    safeAlternative?: string
  ): SecurityResult {
    const result: SecurityResult = {
      actionId,
      riskLevel,
      allowed,
      requiresConfirmation,
      reason,
      matchedRule,
      safeAlternative,
    };

    this.actionLog.push(result);
    if (this.actionLog.length > PermissionSentinel.MAX_ACTIONS) {
      this.actionLog = this.actionLog.slice(-PermissionSentinel.MAX_ACTIONS);
    }
    return result;
  }

  stop(): void {
    // No resources to clean up
  }
}
