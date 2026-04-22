/**
 * SilentWatch Monitor
 * Main monitor class that orchestrates all detectors and notifiers
 */

import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  SilentWatchConfig,
  Alert,
  MonitoringEvent,
  AlertType,
  isDebug,
  debugLog,
} from './config';
import { createLogger } from './logger';
import { Detector, DetectorResult, AlertHandler, MonitorStats, AgentSession, ToolCallEvent, ResponseEvent, CronEvent } from './types';

// Maximum size for alert history file before rotation (1MB)
const MAX_ALERT_HISTORY_SIZE = 1024 * 1024;

// Re-export types for external use
export type { MonitorStats, AgentSession, ToolCallEvent, ResponseEvent, CronEvent, AlertHandler };
import {
  LoopDetector,
  EmptyResponseDetector,
  TimeoutDetector,
  CronMissedDetector,
  AnomalyDetector,
} from './detectors';
import {
  ConsoleNotifier,
  WeChatNotifier,
  TelegramNotifier,
  EmailNotifier,
} from './notifiers';

export class SilentWatchMonitor {
  private config: SilentWatchConfig;
  private detectors: Map<string, Detector> = new Map();
  private eventHistory: MonitoringEvent[] = [];
  private alertHistory: Alert[] = [];
  private stats: MonitorStats;
  private startTime: Date;
  private alertHandler: AlertHandler | undefined;
  private logger = createLogger({ plugin: 'silent-watch' });

  // Notifiers
  private consoleNotifier: ConsoleNotifier;
  private weChatNotifier: WeChatNotifier;
  private telegramNotifier: TelegramNotifier;
  private emailNotifier: EmailNotifier;

  // Alert deduplication: track recent alert fingerprints
  private recentAlertFingerprints: Map<string, Date> = new Map();
  private readonly dedupWindowMs = 300000; // 5 minutes window

  // Performance metrics
  private eventProcessingTime: number[] = [];
  private alertProcessingTime: number[] = [];
  private maxMetricsHistory = 100;

  constructor(config: SilentWatchConfig, alertHandler?: AlertHandler) {
    this.config = config;
    this.alertHandler = alertHandler;
    this.startTime = new Date();
    this.stats = {
      totalEvents: 0,
      totalAlerts: 0,
      uptimeSeconds: 0,
      alertsByType: {
        loop_detected: 0,
        empty_response: 0,
        timeout: 0,
        cron_missed: 0,
        anomaly: 0,
      },
    };

    // Initialize notifiers
    this.consoleNotifier = new ConsoleNotifier(
      config.notifiers.console?.level || 'info'
    );
    this.weChatNotifier = new WeChatNotifier(config.notifiers.wechat);
    this.telegramNotifier = new TelegramNotifier(config.notifiers.telegram);
    this.emailNotifier = new EmailNotifier(config.notifiers.email);

    // Initialize detectors
    this.setupDetectors();

    // Load alert history if exists
    this.loadAlertHistory();

    this.logger.info('Monitor initialized', { detectors: Array.from(this.detectors.keys()) });
  }

  private setupDetectors(): void {
    const detectorConfig = this.config.detectors;

    if (this.config.detectLoops) {
      this.detectors.set('loop', new LoopDetector(detectorConfig));
    }

    if (this.config.detectEmptyResponses) {
      this.detectors.set('empty_response', new EmptyResponseDetector(detectorConfig));
    }

    if (this.config.detectTimeouts) {
      this.detectors.set('timeout', new TimeoutDetector(detectorConfig));
    }

    if (this.config.detectCronMisses) {
      this.detectors.set('cron_missed', new CronMissedDetector(detectorConfig));
    }

    if (this.config.detectAnomalies) {
      this.detectors.set('anomaly', new AnomalyDetector(detectorConfig));
    }
  }

  /**
   * Record a monitoring event
   */
  recordEvent(event: MonitoringEvent): void {
    if (!this.config.enabled) {
      debugLog('Monitor disabled, skipping event');
      return;
    }

    // Ensure timestamp
    if (!event.timestamp) {
      event.timestamp = new Date();
    }

    // Track processing time for performance monitoring
    const startTime = performance.now();

    // Add to history
    const maxHistory = (this.config.detectors.contextSnapshotSize || 10) * 10;
    this.eventHistory.push(event);
    if (this.eventHistory.length > maxHistory) {
      this.eventHistory.shift();
    }

    this.stats.totalEvents++;
    this.stats.lastEventTime = event.timestamp;

    // Record processing time
    const processingTime = performance.now() - startTime;
    this.eventProcessingTime.push(processingTime);
    if (this.eventProcessingTime.length > this.maxMetricsHistory) {
      this.eventProcessingTime.shift();
    }

    debugLog('Recorded event:', event.type, event.tool || event.content?.substring(0, 50));

    // Run all detectors
    this.checkDetectors();
  }

  /**
   * Convenience method: record a tool call
   */
  recordToolCall(toolName: string, args?: Record<string, unknown>, result?: unknown, duration?: number): void {
    // Validate input
    if (!toolName || typeof toolName !== 'string') {
      this.logger.warn('Invalid toolName provided', { toolName });
      return;
    }
    if (duration !== undefined && (typeof duration !== 'number' || duration < 0)) {
      this.logger.warn('Invalid duration provided', { duration });
      return;
    }

    this.recordEvent({
      timestamp: new Date(),
      type: 'tool_call',
      tool: toolName,
      duration,
      metadata: { args, result },
    });
  }

  /**
   * Convenience method: record a response
   */
  recordResponse(content: string, responseLength?: number): void {
    // Validate input
    if (content === undefined || content === null) {
      this.logger.warn('Invalid content provided to recordResponse');
      return;
    }

    const isEmpty = !content || content.trim() === '';
    const isNO_REPLY = content === 'NO_REPLY';

    this.recordEvent({
      timestamp: new Date(),
      type: isEmpty || isNO_REPLY ? 'empty_response' : 'normal',
      content,
      responseLength: responseLength ?? content.length,
    });
  }

  /**
   * Convenience method: record cron trigger
   */
  recordCronTrigger(jobName: string, jobId: string): void {
    const detector = this.detectors.get('cron_missed') as CronMissedDetector | undefined;
    if (detector) {
      detector.markTaskRan(jobId);
    }

    this.recordEvent({
      timestamp: new Date(),
      type: 'cron_trigger',
      metadata: { jobName, jobId },
    });
  }

  /**
   * Register a scheduled task for monitoring
   */
  registerCronTask(name: string, id: string, intervalMs: number): void {
    // Validate input
    if (!name || !id) {
      this.logger.warn('Invalid task registration: name and id are required');
      return;
    }
    if (!intervalMs || intervalMs < 1000) {
      this.logger.warn('Invalid intervalMs: must be at least 1000ms', { intervalMs });
      return;
    }

    const detector = this.detectors.get('cron_missed') as CronMissedDetector | undefined;
    if (detector) {
      detector.registerTask({ name, id, intervalMs });
    }
  }

  /**
   * Check all detectors and trigger alerts if needed
   */
  private checkDetectors(): void {
    const events = this.eventHistory;

    // Collect all triggered alerts first to avoid concurrency issues
    const alertsToTrigger: Array<{ name: string; result: DetectorResult }> = [];

    for (const [name, detector] of this.detectors) {
      try {
        const result = detector.check(events);

        if (result.triggered && result.alertType) {
          alertsToTrigger.push({ name, result });
        }
      } catch (error) {
        this.logger.error(`Detector ${name} error`, { detector: name, error: String(error) });
      }
    }

    // Process all alerts after all detectors have finished checking
    const triggeredDetectorNames = new Set<string>();
    for (const { name, result } of alertsToTrigger) {
      this.triggerAlert({
        id: uuidv4(),
        type: result.alertType!,
        severity: result.severity || 'medium',
        message: result.message || `Alert from ${name}`,
        details: result.details || {},
        context: {
          recentEvents: events.slice(-(this.config.detectors.contextSnapshotSize || 10)),
          triggerCondition: name,
          suggestedFix: result.suggestedFix,
        },
        timestamp: new Date(),
        acknowledged: false,
      });
      triggeredDetectorNames.add(name);
    }

    // Only reset detectors that actually triggered
    for (const name of triggeredDetectorNames) {
      const detector = this.detectors.get(name);
      if (detector) {
        detector.reset();
      }
    }
  }

  /**
   * Generate a fingerprint for alert deduplication
   */
  private getAlertFingerprint(alert: Alert): string {
    // Use alert type + tool name (NOT message, which may contain dynamic counts)
    const toolInfo = alert.details.toolName ? `:${alert.details.toolName}` : '';
    const jobId = alert.details.jobId ? `:${alert.details.jobId}` : '';
    return `${alert.type}:${toolInfo}${jobId}`;
  }

  /**
   * Check if alert is a duplicate within the deduplication window
   */
  private isDuplicateAlert(alert: Alert): boolean {
    const fingerprint = this.getAlertFingerprint(alert);
    const lastSeen = this.recentAlertFingerprints.get(fingerprint);

    if (!lastSeen) {
      return false;
    }

    const elapsed = alert.timestamp.getTime() - lastSeen.getTime();
    return elapsed < this.dedupWindowMs;
  }

  /**
   * Acquire a file lock with timeout
   * @param path - The file path to lock
   * @param maxWaitMs - Maximum time to wait for lock acquisition
   * @returns true if lock acquired, false if timeout
   */
  private async acquireLock(path: string, maxWaitMs: number): Promise<boolean> {
    const lockPath = path + '.lock';
    const startTime = Date.now();

    while (true) {
      try {
        // Try to create the lock file exclusively
        fs.writeFileSync(lockPath, process.pid.toString(), { flag: 'wx' });
        return true;
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
          // Unexpected error, don't retry
          this.logger.error('Lock acquisition error', { error: String(error) });
          return false;
        }

        // Lock exists, check if it's stale (older than maxWaitMs)
        try {
          const stats = fs.statSync(lockPath);
          const age = Date.now() - stats.mtime.getTime();
          if (age > maxWaitMs) {
            // Stale lock, try to remove it
            try {
              fs.unlinkSync(lockPath);
              continue;
            } catch {
              // Another process took it, continue waiting
            }
          }
        } catch {
          // Lock file disappeared, try again
          continue;
        }

        // Check timeout
        if (Date.now() - startTime >= maxWaitMs) {
          return false;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  }

  /**
   * Release a file lock
   * @param path - The file path to unlock
   */
  private async releaseLock(path: string): Promise<void> {
    const lockPath = path + '.lock';
    try {
      fs.unlinkSync(lockPath);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error('Lock release error', { error: String(error) });
      }
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(alert: Alert): void {
    // Track processing time for performance monitoring
    const startTime = performance.now();

    // Check for duplicate alerts
    if (this.isDuplicateAlert(alert)) {
      this.logger.info('Duplicate alert suppressed', { alertType: alert.type, message: alert.message });
      // Don't save suppressed alerts to history or update stats
      return;
    }

    this.logger.info('Alert triggered', { alertType: alert.type, severity: alert.severity, message: alert.message });

    // Track this alert fingerprint for deduplication
    const fingerprint = this.getAlertFingerprint(alert);
    this.recentAlertFingerprints.set(fingerprint, alert.timestamp);

    // Clean up old fingerprints (older than 2x the window)
    const now = new Date();
    const cutoff = new Date(now.getTime() - this.dedupWindowMs * 2);
    for (const [fp, time] of this.recentAlertFingerprints.entries()) {
      if (time < cutoff) {
        this.recentAlertFingerprints.delete(fp);
      }
    }

    // Update stats
    this.stats.totalAlerts++;
    this.stats.alertsByType[alert.type]++;
    this.stats.lastAlertTime = alert.timestamp;

    // Save to history
    this.alertHistory.push(alert);
    this.saveAlertHistory().catch(err =>
      this.logger.error('Failed to save alert history', { error: String(err) })
    );

    // Send to all notifiers (fire-and-forget for sync compatibility)
    this.consoleNotifier.send(alert).catch(err =>
      this.logger.error('Console notifier error', { error: String(err) })
    );
    this.weChatNotifier.send(alert).catch(err =>
      this.logger.error('WeChat notifier error', { error: String(err) })
    );
    this.telegramNotifier.send(alert).catch(err =>
      this.logger.error('Telegram notifier error', { error: String(err) })
    );
    this.emailNotifier.send(alert).catch(err =>
      this.logger.error('Email notifier error', { error: String(err) })
    );

    // Call custom handler if set
    if (this.alertHandler) {
      try {
        const result = this.alertHandler(alert);
        // Handle async handlers
        if (result && typeof result.catch === 'function') {
          result.catch((err: unknown) =>
            this.logger.error('Custom alert handler error', { error: String(err) })
          );
        }
      } catch (error) {
        this.logger.error('Custom alert handler error', { error: String(error) });
      }
    }

    // Also call config callback if set
    if (this.config.onAlert) {
      try {
        this.config.onAlert(alert);
      } catch (error) {
        this.logger.error('Config onAlert callback error', { error: String(error) });
      }
    }

    // Record processing time
    const processingTime = performance.now() - startTime;
    this.alertProcessingTime.push(processingTime);
    if (this.alertProcessingTime.length > this.maxMetricsHistory) {
      this.alertProcessingTime.shift();
    }
  }

  /**
   * Load alert history from file
   */
  private async loadAlertHistory(): Promise<void> {
    if (!this.config.alertHistoryPath) return;
    const lockPath = this.config.alertHistoryPath + '.lock';
    const acquired = await this.acquireLock(lockPath, 5000);
    if (!acquired) {
      this.logger.warn('Could not acquire lock for alert history, skipping');
      return;
    }
    try {
      if (fs.existsSync(this.config.alertHistoryPath)) {
        const data = fs.readFileSync(this.config.alertHistoryPath, 'utf-8');
        const alerts = JSON.parse(data);
        this.alertHistory = alerts.map((a: Alert) => ({
          ...a,
          timestamp: new Date(a.timestamp),
        }));
        this.logger.info('Loaded past alerts', { count: this.alertHistory.length });
      }
    } catch (error) {
      this.logger.error('Failed to load alert history', { error: String(error) });
      this.alertHistory = [];
    } finally {
      await this.releaseLock(lockPath);
    }
  }

  /**
   * Rotate alert history file if it exceeds the size limit
   * Keeps up to 3 rotated files (.1, .2, .3)
   */
  private rotateAlertHistoryIfNeeded(): void {
    const historyPath = this.config.alertHistoryPath;
    if (!historyPath) return;

    try {
      if (!fs.existsSync(historyPath)) return;

      const stats = fs.statSync(historyPath);
      if (stats.size <= MAX_ALERT_HISTORY_SIZE) return;

      // Rotate: .3 -> delete, .2 -> .3, .1 -> .2, main -> .1
      const rotatedPath3 = historyPath + '.3';
      const rotatedPath2 = historyPath + '.2';
      const rotatedPath1 = historyPath + '.1';

      // Delete oldest rotation file if it exists
      if (fs.existsSync(rotatedPath3)) {
        fs.unlinkSync(rotatedPath3);
      }

      // Shift rotation files
      if (fs.existsSync(rotatedPath2)) {
        fs.renameSync(rotatedPath2, rotatedPath3);
      }
      if (fs.existsSync(rotatedPath1)) {
        fs.renameSync(rotatedPath1, rotatedPath2);
      }

      // Rotate main file to .1
      fs.renameSync(historyPath, rotatedPath1);

      this.logger.info('Alert history file rotated due to size', { size: stats.size });
    } catch (error) {
      this.logger.error('Failed to rotate alert history', { error: String(error) });
    }
  }

  /**
   * Save alert history to file
   */
  private async saveAlertHistory(): Promise<void> {
    if (!this.config.alertHistoryPath) return;
    const lockPath = this.config.alertHistoryPath + '.lock';
    const acquired = await this.acquireLock(lockPath, 5000);
    if (!acquired) {
      console.warn('[SilentWatch] Could not acquire lock for alert history, skipping');
      return;
    }
    try {
      // Rotate file if it exceeds size limit
      this.rotateAlertHistoryIfNeeded();

      // Keep last 100 alerts
      const toSave = this.alertHistory.slice(-100);
      await fs.promises.writeFile(
        this.config.alertHistoryPath,
        JSON.stringify(toSave, null, 2)
      );
    } catch (error) {
      this.logger.error('Failed to save alert history', { error: String(error) });
    } finally {
      await this.releaseLock(lockPath);
    }
  }

  /**
   * Get current monitoring statistics
   */
  getStats(): MonitorStats {
    return {
      ...this.stats,
      uptimeSeconds: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    avgEventProcessingTime: number;
    avgAlertProcessingTime: number;
    totalEventsProcessed: number;
    memoryUsage?: NodeJS.MemoryUsage;
  } {
    const avgEventTime = this.eventProcessingTime.length > 0
      ? this.eventProcessingTime.reduce((a, b) => a + b, 0) / this.eventProcessingTime.length
      : 0;

    const avgAlertTime = this.alertProcessingTime.length > 0
      ? this.alertProcessingTime.reduce((a, b) => a + b, 0) / this.alertProcessingTime.length
      : 0;

    return {
      avgEventProcessingTime: Math.round(avgEventTime),
      avgAlertProcessingTime: Math.round(avgAlertTime),
      totalEventsProcessed: this.stats.totalEvents,
      memoryUsage: process.memoryUsage(),
    };
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit = 10): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.saveAlertHistory().catch(err =>
        this.logger.error('Failed to save alert history', { error: String(err) })
      );
      return true;
    }
    return false;
  }

  /**
   * Reset all detectors
   */
  resetAllDetectors(): void {
    for (const detector of this.detectors.values()) {
      detector.reset();
    }
    this.logger.info('All detectors reset');
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(config: Partial<SilentWatchConfig>): void {
    // Deep merge to avoid mutating nested objects
    const prevConfig = this.config;
    this.config = structuredClone({ ...prevConfig, ...config });
    this.logger.info('Configuration updated');
  }

  /**
   * Health check - returns current health status
   */
  healthCheck(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    lastCheck: Date;
    detectors: Record<string, 'active' | 'inactive' | 'error'>;
    notifiers: Record<string, 'active' | 'inactive' | 'error'>;
  } {
    const detectorStatus: Record<string, 'active' | 'inactive' | 'error'> = {};
    const notifierStatus: Record<string, 'active' | 'inactive' | 'error'> = {};

    // Check detectors
    for (const [name, detector] of this.detectors) {
      try {
        detector.check([]);
        detectorStatus[name] = 'active';
      } catch {
        detectorStatus[name] = 'error';
      }
    }

    // Check notifiers
    const notifierEntries = [
      ['console', this.config.notifiers.console],
      ['wechat', this.config.notifiers.wechat],
      ['telegram', this.config.notifiers.telegram],
      ['email', this.config.notifiers.email],
    ] as const;

    for (const [name, cfg] of notifierEntries) {
      if (cfg?.enabled) {
        notifierStatus[name] = 'active';
      } else {
        notifierStatus[name] = 'inactive';
      }
    }

    // Determine overall status
    const hasErrors = Object.values(detectorStatus).some(s => s === 'error');
    const hasActiveDetectors = Object.values(detectorStatus).some(s => s === 'active');
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (hasErrors) {
      status = 'unhealthy';
    } else if (!hasActiveDetectors) {
      status = 'degraded';
    }

    return {
      status,
      uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      lastCheck: new Date(),
      detectors: detectorStatus,
      notifiers: notifierStatus,
    };
  }

  /**
   * Stop the monitor
   */
  stop(): void {
    this.logger.info('Monitor stopped');
    this.saveAlertHistory().catch(err =>
      this.logger.error('Failed to save alert history', { error: String(err) })
    );
  }
}
