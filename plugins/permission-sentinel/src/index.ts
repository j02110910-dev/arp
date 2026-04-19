/**
 * Permission Sentinel - Security Firewall
 * Checks agent actions and sanitizes sensitive data
 */

export {
  PermissionSentinelConfig,
  SecurityAction,
  SecurityResult,
  SecurityRule,
  SanitizationResult,
  SensitiveDataMatch,
  RiskLevel,
  SanitizerPattern,
} from './types';

export { loadConfig, getDefaultConfig } from './config';
export { PermissionSentinel } from './sentinel';
