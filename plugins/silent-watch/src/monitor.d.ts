/**
 * SilentWatch Monitor
 * Main monitor class that orchestrates all detectors and notifiers
 */
import { SilentWatchConfig, Alert, MonitoringEvent } from './config';
import { AlertHandler, MonitorStats, AgentSession, ToolCallEvent, ResponseEvent, CronEvent } from './types';
export type { MonitorStats, AgentSession, ToolCallEvent, ResponseEvent, CronEvent, AlertHandler };
export declare class SilentWatchMonitor {
    private config;
    private detectors;
    private eventHistory;
    private alertHistory;
    private stats;
    private startTime;
    private alertHandler;
    private consoleNotifier;
    private weChatNotifier;
    private telegramNotifier;
    private emailNotifier;
    private recentAlertFingerprints;
    private readonly dedupWindowMs;
    private eventProcessingTime;
    private alertProcessingTime;
    private maxMetricsHistory;
    constructor(config: SilentWatchConfig, alertHandler?: AlertHandler);
    private setupDetectors;
    /**
     * Record a monitoring event
     */
    recordEvent(event: MonitoringEvent): void;
    /**
     * Convenience method: record a tool call
     */
    recordToolCall(toolName: string, args?: Record<string, unknown>, result?: unknown, duration?: number): void;
    /**
     * Convenience method: record a response
     */
    recordResponse(content: string, responseLength?: number): void;
    /**
     * Convenience method: record cron trigger
     */
    recordCronTrigger(jobName: string, jobId: string): void;
    /**
     * Register a scheduled task for monitoring
     */
    registerCronTask(name: string, id: string, intervalMs: number): void;
    /**
     * Check all detectors and trigger alerts if needed
     */
    private checkDetectors;
    /**
     * Generate a fingerprint for alert deduplication
     */
    private getAlertFingerprint;
    /**
     * Check if alert is a duplicate within the deduplication window
     */
    private isDuplicateAlert;
    /**
     * Trigger an alert
     */
    private triggerAlert;
    /**
     * Load alert history from file
     */
    private loadAlertHistory;
    /**
     * Save alert history to file
     */
    private saveAlertHistory;
    /**
     * Get current monitoring statistics
     */
    getStats(): MonitorStats;
    /**
     * Get performance metrics
     */
    getPerformanceMetrics(): {
        avgEventProcessingTime: number;
        avgAlertProcessingTime: number;
        totalEventsProcessed: number;
        memoryUsage?: NodeJS.MemoryUsage;
    };
    /**
     * Get recent alerts
     */
    getRecentAlerts(limit?: number): Alert[];
    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId: string): boolean;
    /**
     * Reset all detectors
     */
    resetAllDetectors(): void;
    /**
     * Update configuration at runtime
     */
    updateConfig(config: Partial<SilentWatchConfig>): void;
    /**
     * Health check - returns current health status
     */
    healthCheck(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        uptime: number;
        lastCheck: Date;
        detectors: Record<string, 'active' | 'inactive' | 'error'>;
        notifiers: Record<string, 'active' | 'inactive' | 'error'>;
    };
    /**
     * Stop the monitor
     */
    stop(): void;
}
