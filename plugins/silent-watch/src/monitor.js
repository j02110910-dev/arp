"use strict";
/**
 * SilentWatch Monitor
 * Main monitor class that orchestrates all detectors and notifiers
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SilentWatchMonitor = void 0;
const fs = __importStar(require("fs"));
const uuid_1 = require("uuid");
const config_1 = require("./config");
const detectors_1 = require("./detectors");
const notifiers_1 = require("./notifiers");
class SilentWatchMonitor {
    config;
    detectors = new Map();
    eventHistory = [];
    alertHistory = [];
    stats;
    startTime;
    alertHandler;
    // Notifiers
    consoleNotifier;
    weChatNotifier;
    telegramNotifier;
    emailNotifier;
    // Alert deduplication: track recent alert fingerprints
    recentAlertFingerprints = new Map();
    dedupWindowMs = 300000; // 5 minutes window
    // Performance metrics
    eventProcessingTime = [];
    alertProcessingTime = [];
    maxMetricsHistory = 100;
    constructor(config, alertHandler) {
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
        this.consoleNotifier = new notifiers_1.ConsoleNotifier(config.notifiers.console?.level || 'info');
        this.weChatNotifier = new notifiers_1.WeChatNotifier(config.notifiers.wechat);
        this.telegramNotifier = new notifiers_1.TelegramNotifier(config.notifiers.telegram);
        this.emailNotifier = new notifiers_1.EmailNotifier(config.notifiers.email);
        // Initialize detectors
        this.setupDetectors();
        // Load alert history if exists
        this.loadAlertHistory();
        console.log('[SilentWatch] Monitor initialized');
        console.log(`[SilentWatch] Active detectors: ${Array.from(this.detectors.keys()).join(', ')}`);
    }
    setupDetectors() {
        const detectorConfig = this.config.detectors;
        if (this.config.detectLoops) {
            this.detectors.set('loop', new detectors_1.LoopDetector(detectorConfig));
        }
        if (this.config.detectEmptyResponses) {
            this.detectors.set('empty_response', new detectors_1.EmptyResponseDetector(detectorConfig));
        }
        if (this.config.detectTimeouts) {
            this.detectors.set('timeout', new detectors_1.TimeoutDetector(detectorConfig));
        }
        if (this.config.detectCronMisses) {
            this.detectors.set('cron_missed', new detectors_1.CronMissedDetector(detectorConfig));
        }
        if (this.config.detectAnomalies) {
            this.detectors.set('anomaly', new detectors_1.AnomalyDetector(detectorConfig));
        }
    }
    /**
     * Record a monitoring event
     */
    recordEvent(event) {
        if (!this.config.enabled) {
            (0, config_1.debugLog)('Monitor disabled, skipping event');
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
        (0, config_1.debugLog)('Recorded event:', event.type, event.tool || event.content?.substring(0, 50));
        // Run all detectors
        this.checkDetectors();
    }
    /**
     * Convenience method: record a tool call
     */
    recordToolCall(toolName, args, result, duration) {
        // Validate input
        if (!toolName || typeof toolName !== 'string') {
            console.warn('[SilentWatch] Invalid toolName provided:', toolName);
            return;
        }
        if (duration !== undefined && (typeof duration !== 'number' || duration < 0)) {
            console.warn('[SilentWatch] Invalid duration provided:', duration);
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
    recordResponse(content, responseLength) {
        // Validate input
        if (content === undefined || content === null) {
            console.warn('[SilentWatch] Invalid content provided to recordResponse');
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
    recordCronTrigger(jobName, jobId) {
        const detector = this.detectors.get('cron_missed');
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
    registerCronTask(name, id, intervalMs) {
        // Validate input
        if (!name || !id) {
            console.warn('[SilentWatch] Invalid task registration: name and id are required');
            return;
        }
        if (!intervalMs || intervalMs < 1000) {
            console.warn('[SilentWatch] Invalid intervalMs: must be at least 1000ms');
            return;
        }
        const detector = this.detectors.get('cron_missed');
        if (detector) {
            detector.registerTask({ name, id, intervalMs });
        }
    }
    /**
     * Check all detectors and trigger alerts if needed
     */
    checkDetectors() {
        const events = this.eventHistory;
        // Collect all triggered alerts first to avoid concurrency issues
        const alertsToTrigger = [];
        for (const [name, detector] of this.detectors) {
            try {
                const result = detector.check(events);
                if (result.triggered && result.alertType) {
                    alertsToTrigger.push({ name, result });
                }
            }
            catch (error) {
                console.error(`[SilentWatch] Detector ${name} error:`, error);
            }
        }
        // Process all alerts after all detectors have finished checking
        const triggeredDetectorNames = new Set();
        for (const { name, result } of alertsToTrigger) {
            this.triggerAlert({
                id: (0, uuid_1.v4)(),
                type: result.alertType,
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
    getAlertFingerprint(alert) {
        // Use alert type + tool name (NOT message, which may contain dynamic counts)
        const toolInfo = alert.details.toolName ? `:${alert.details.toolName}` : '';
        const jobId = alert.details.jobId ? `:${alert.details.jobId}` : '';
        return `${alert.type}:${toolInfo}${jobId}`;
    }
    /**
     * Check if alert is a duplicate within the deduplication window
     */
    isDuplicateAlert(alert) {
        const fingerprint = this.getAlertFingerprint(alert);
        const lastSeen = this.recentAlertFingerprints.get(fingerprint);
        if (!lastSeen) {
            return false;
        }
        const elapsed = alert.timestamp.getTime() - lastSeen.getTime();
        return elapsed < this.dedupWindowMs;
    }
    /**
     * Trigger an alert
     */
    triggerAlert(alert) {
        // Track processing time for performance monitoring
        const startTime = performance.now();
        // Check for duplicate alerts
        if (this.isDuplicateAlert(alert)) {
            console.log(`[SilentWatch] 🚫 Duplicate alert suppressed: ${alert.message}`);
            // Don't save suppressed alerts to history or update stats
            return;
        }
        console.log(`[SilentWatch] 🚨 Alert triggered: ${alert.message}`);
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
        this.saveAlertHistory();
        // Send to all notifiers (fire-and-forget for sync compatibility)
        this.consoleNotifier.send(alert).catch(err => console.error('[SilentWatch] Console notifier error:', err));
        this.weChatNotifier.send(alert).catch(err => console.error('[SilentWatch] WeChat notifier error:', err));
        this.telegramNotifier.send(alert).catch(err => console.error('[SilentWatch] Telegram notifier error:', err));
        this.emailNotifier.send(alert).catch(err => console.error('[SilentWatch] Email notifier error:', err));
        // Call custom handler if set
        if (this.alertHandler) {
            try {
                const result = this.alertHandler(alert);
                // Handle async handlers
                if (result && typeof result.catch === 'function') {
                    result.catch((err) => console.error('[SilentWatch] Custom alert handler error:', err));
                }
            }
            catch (error) {
                console.error('[SilentWatch] Custom alert handler error:', error);
            }
        }
        // Also call config callback if set
        if (this.config.onAlert) {
            try {
                this.config.onAlert(alert);
            }
            catch (error) {
                console.error('[SilentWatch] Config onAlert callback error:', error);
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
    loadAlertHistory() {
        if (!this.config.alertHistoryPath)
            return;
        try {
            if (fs.existsSync(this.config.alertHistoryPath)) {
                const data = fs.readFileSync(this.config.alertHistoryPath, 'utf-8');
                const alerts = JSON.parse(data);
                this.alertHistory = alerts.map((a) => ({
                    ...a,
                    timestamp: new Date(a.timestamp),
                }));
                console.log(`[SilentWatch] Loaded ${this.alertHistory.length} past alerts`);
            }
        }
        catch (error) {
            console.error('[SilentWatch] Failed to load alert history:', error);
            this.alertHistory = [];
        }
    }
    /**
     * Save alert history to file
     */
    saveAlertHistory() {
        if (!this.config.alertHistoryPath)
            return;
        try {
            // Keep last 100 alerts
            const toSave = this.alertHistory.slice(-100);
            fs.writeFileSync(this.config.alertHistoryPath, JSON.stringify(toSave, null, 2));
        }
        catch (error) {
            console.error('[SilentWatch] Failed to save alert history:', error);
        }
    }
    /**
     * Get current monitoring statistics
     */
    getStats() {
        return {
            ...this.stats,
            uptimeSeconds: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
        };
    }
    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
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
    getRecentAlerts(limit = 10) {
        return this.alertHistory.slice(-limit);
    }
    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId) {
        const alert = this.alertHistory.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
            this.saveAlertHistory();
            return true;
        }
        return false;
    }
    /**
     * Reset all detectors
     */
    resetAllDetectors() {
        for (const detector of this.detectors.values()) {
            detector.reset();
        }
        console.log('[SilentWatch] All detectors reset');
    }
    /**
     * Update configuration at runtime
     */
    updateConfig(config) {
        Object.assign(this.config, config);
        console.log('[SilentWatch] Configuration updated');
    }
    /**
     * Health check - returns current health status
     */
    healthCheck() {
        const detectorStatus = {};
        const notifierStatus = {};
        // Check detectors
        for (const [name, detector] of this.detectors) {
            try {
                detector.check([]);
                detectorStatus[name] = 'active';
            }
            catch {
                detectorStatus[name] = 'error';
            }
        }
        // Check notifiers
        const notifierEntries = [
            ['console', this.config.notifiers.console],
            ['wechat', this.config.notifiers.wechat],
            ['telegram', this.config.notifiers.telegram],
            ['email', this.config.notifiers.email],
        ];
        for (const [name, cfg] of notifierEntries) {
            if (cfg?.enabled) {
                notifierStatus[name] = 'active';
            }
            else {
                notifierStatus[name] = 'inactive';
            }
        }
        // Determine overall status
        const hasErrors = Object.values(detectorStatus).some(s => s === 'error');
        const hasActiveDetectors = Object.values(detectorStatus).some(s => s === 'active');
        let status = 'healthy';
        if (hasErrors) {
            status = 'unhealthy';
        }
        else if (!hasActiveDetectors) {
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
    stop() {
        console.log('[SilentWatch] Monitor stopped');
        this.saveAlertHistory();
    }
}
exports.SilentWatchMonitor = SilentWatchMonitor;
//# sourceMappingURL=monitor.js.map