/**
 * Permission Sentinel - Main Class
 * Security firewall that checks agent actions and sanitizes sensitive data
 */
import { PermissionSentinelConfig, SecurityAction, SecurityResult, SecurityRule, SanitizationResult, RiskLevel } from './types';
export declare class PermissionSentinel {
    private config;
    private rules;
    private actionLog;
    private customSanitizers;
    constructor(config: PermissionSentinelConfig);
    private setupRules;
    private setupCustomSanitizers;
    /**
     * Check if a command/action is safe
     */
    checkAction(action: SecurityAction): SecurityResult;
    /**
     * Quick check: just check a command string
     */
    checkCommand(command: string, context?: string): SecurityResult;
    /**
     * Sanitize text by replacing sensitive data with placeholders
     */
    sanitize(text: string): SanitizationResult;
    /**
     * Restore sanitized text (reverse the sanitization)
     * Note: This only works if the original values are provided
     */
    restore(sanitized: string, originalValues: Map<string, string>): string;
    /**
     * Get action check history
     */
    getHistory(limit?: number): SecurityResult[];
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
    };
    /**
     * Add a custom security rule
     */
    addRule(rule: SecurityRule): void;
    /**
     * Remove a rule by ID
     */
    removeRule(id: string): boolean;
    /**
     * Get all active rules
     */
    getRules(): SecurityRule[];
    private buildResult;
    stop(): void;
}
