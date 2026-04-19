/**
 * SilentWatch - Agent Silent Failure Detector
 * Configuration management
 */
export declare const isDebug: boolean;
/**
 * Debug logging helper
 */
export declare function debugLog(message: string, ...args: unknown[]): void;
export interface DetectorConfig {
    /** Maximum consecutive calls to same tool before triggering alert */
    maxConsecutiveCalls?: number;
    /** Maximum consecutive empty responses before triggering alert */
    maxConsecutiveEmpty?: number;
    /** Timeout for single step in milliseconds */
    stepTimeoutMs?: number;
    /** Number of recent events to include in alert context */
    contextSnapshotSize?: number;
}
export interface NotifierConfig {
    /** Enable WeChat (Server酱) notifications */
    wechat?: {
        enabled: boolean;
        server酱Key?: string;
    };
    /** Enable Telegram notifications */
    telegram?: {
        enabled: boolean;
        botToken?: string;
        chatId?: string;
    };
    /** Enable Email notifications */
    email?: {
        enabled: boolean;
        smtpHost?: string;
        smtpPort?: number;
        smtpUser?: string;
        smtpPass?: string;
        toEmail?: string;
        fromEmail?: string;
    };
    /** Enable console/log output */
    console?: {
        enabled: boolean;
        level?: 'debug' | 'info' | 'warn' | 'error';
    };
}
export interface SilentWatchConfig {
    /** Enable/disable entire monitor */
    enabled: boolean;
    /** Detect loops (same tool called repeatedly) */
    detectLoops: boolean;
    /** Detect empty/silent responses */
    detectEmptyResponses: boolean;
    /** Detect timeouts on individual steps */
    detectTimeouts: boolean;
    /** Detect missing scheduled tasks */
    detectCronMisses: boolean;
    /** Detect anomalous behavior patterns */
    detectAnomalies: boolean;
    /** Per-detector configuration */
    detectors: DetectorConfig;
    /** Notification channels */
    notifiers: NotifierConfig;
    /** Path to store alert history */
    alertHistoryPath?: string;
    /** Callback when alert is triggered (alternative to notifiers) */
    onAlert?: (alert: Alert) => void;
    /** HTTP API authentication key (optional, for security) */
    apiKey?: string;
    /** HTTP server configuration */
    server?: {
        /** Enable API authentication */
        requireAuth?: boolean;
    };
}
export interface Alert {
    id: string;
    type: AlertType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    details: Record<string, unknown>;
    context: AlertContext;
    timestamp: Date;
    acknowledged: boolean;
}
export interface AlertContext {
    recentEvents: MonitoringEvent[];
    triggerCondition: string;
    suggestedFix?: string;
}
export interface MonitoringEvent {
    timestamp: Date;
    type: EventType;
    tool?: string;
    model?: string;
    duration?: number;
    responseLength?: number;
    content?: string;
    metadata?: Record<string, unknown>;
}
export type AlertType = 'loop_detected' | 'empty_response' | 'timeout' | 'cron_missed' | 'anomaly';
export type EventType = 'tool_call' | 'empty_response' | 'timeout' | 'cron_trigger' | 'cron_miss' | 'anomalous_pattern' | 'normal';
declare const DEFAULT_CONFIG: SilentWatchConfig;
/**
 * Load configuration from environment and optionally from a config file
 */
export declare function loadConfig(configPath?: string): SilentWatchConfig;
/**
 * Get default config file path
 */
export declare function getDefaultConfigPath(): string;
export { DEFAULT_CONFIG };
