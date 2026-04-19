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
    pattern: /\b(sk-|ak-|api[_-]?key[=:]?\s*)[a-zA-Z0-9]{20,}\b/gi,
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

export class PermissionSentinel {
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

    // Check whitelist first
    if (this.config.safeCommands) {
      for (const safe of this.config.safeCommands) {
        if (command.startsWith(safe.toLowerCase())) {
          return this.buildResult(action.id, 'safe', true, false, `Whitelisted: ${safe}`);
        }
      }
    }

    // Check blacklist
    if (this.config.blockedCommands) {
      for (const blocked of this.config.blockedCommands) {
        if (command.includes(blocked.toLowerCase())) {
          return this.buildResult(action.id, 'critical', false, false,
            `Blocked: "${blocked}" is in the blacklist`, `blocked:${blocked}`);
        }
      }
    }

    // Check rules
    for (const rule of this.rules) {
      try {
        const regex = new RegExp(rule.pattern, 'i');
        if (regex.test(action.command)) {
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
      } catch {
        // Invalid regex, skip
      }
    }

    return this.buildResult(action.id, 'safe', true, false, 'No security concerns detected');
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
          allMatches.push({
            type: sp.type,
            original: match[0],
            replacement: sp.replacement,
            position: { start: match.index, end: match.index + match[0].length },
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
      restored = restored.replace(placeholder, original);
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
    return result;
  }

  stop(): void {
    // No resources to clean up
  }
}
