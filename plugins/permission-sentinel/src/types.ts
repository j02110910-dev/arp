/**
 * Permission Sentinel - Type Definitions
 * Security firewall between Agent and the physical world
 */

/** Security risk level */
export type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';

/** Action that needs to be checked */
export interface SecurityAction {
  /** Unique ID */
  id: string;
  /** Action type */
  type: 'command' | 'file_operation' | 'network' | 'data_access' | 'api_call';
  /** The actual command/request */
  command: string;
  /** Arguments/parameters */
  args?: Record<string, unknown>;
  /** Timestamp */
  timestamp: Date;
  /** Context (which tool, what agent is doing) */
  context?: string;
}

/** Result of security check */
export interface SecurityResult {
  /** Action ID */
  actionId: string;
  /** Risk level */
  riskLevel: RiskLevel;
  /** Is this action allowed? */
  allowed: boolean;
  /** Does this require user confirmation? */
  requiresConfirmation: boolean;
  /** Human-readable reason */
  reason: string;
  /** Matched rule */
  matchedRule?: string;
  /** Suggested safe alternative */
  safeAlternative?: string;
  /** Sanitized version of the command (if applicable) */
  sanitizedCommand?: string;
}

/** Sensitive data pattern found */
export interface SensitiveDataMatch {
  /** Type of sensitive data */
  type: 'phone' | 'email' | 'id_card' | 'credit_card' | 'api_key' | 'password' | 'token' | 'ip_address' | 'custom';
  /** Original value */
  original: string;
  /** Sanitized replacement */
  replacement: string;
  /** Position in text */
  position: { start: number; end: number };
}

/** Sanitization result */
export interface SanitizationResult {
  /** Original text */
  original: string;
  /** Sanitized text */
  sanitized: string;
  /** Matches found and replaced */
  matches: SensitiveDataMatch[];
  /** Was anything changed? */
  wasModified: boolean;
}

/** Security rule */
export interface SecurityRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Pattern to match (regex string) */
  pattern: string;
  /** Risk level when matched */
  riskLevel: RiskLevel;
  /** Description */
  description: string;
  /** Whether to block or just warn */
  action: 'block' | 'warn' | 'confirm';
  /** Safe alternative suggestion */
  safeAlternative?: string;
}

/** Custom sanitizer pattern */
export interface SanitizerPattern {
  /** Pattern name */
  name: string;
  /** Regex pattern */
  pattern: RegExp;
  /** Replacement template */
  replacement: string;
}

/** Permission Sentinel configuration */
export interface PermissionSentinelConfig {
  /** Enable/disable */
  enabled: boolean;
  /** Custom security rules */
  rules?: SecurityRule[];
  /** Enable sensitive data sanitization */
  enableSanitization: boolean;
  /** Enable command checking */
  enableCommandCheck: boolean;
  /** Enable network checking */
  enableNetworkCheck: boolean;
  /** Whitelist of safe commands (always allowed) */
  safeCommands?: string[];
  /** Blacklist of blocked commands (always blocked) */
  blockedCommands?: string[];
  /** Custom sanitizer patterns */
  customSanitizers?: SanitizerPattern[];
  /** Path to persist log */
  logPath?: string;
}
