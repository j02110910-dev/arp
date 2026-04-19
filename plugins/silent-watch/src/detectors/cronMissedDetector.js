"use strict";
/**
 * Cron Missed Detector
 * Detects when scheduled/heartbeat tasks fail to trigger
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CronMissedDetector = void 0;
class CronMissedDetector {
    name = 'cron_missed_detector';
    config;
    scheduledTasks = new Map();
    toleranceMs = 30000; // 30 seconds tolerance
    constructor(config) {
        this.config = {
            contextSnapshotSize: config.contextSnapshotSize || 10,
        };
    }
    /**
     * Register a scheduled task to monitor
     */
    registerTask(task) {
        this.scheduledTasks.set(task.id, {
            ...task,
            lastRunTime: task.lastRunTime || new Date(),
            expectedRunTime: new Date(Date.now() + task.intervalMs),
        });
    }
    /**
     * Mark a task as run (call this when your cron/heartbeat fires)
     */
    markTaskRan(taskId) {
        const task = this.scheduledTasks.get(taskId);
        if (task) {
            task.lastRunTime = new Date();
            task.expectedRunTime = new Date(Date.now() + task.intervalMs);
        }
    }
    /**
     * Unregister a task
     */
    unregisterTask(taskId) {
        this.scheduledTasks.delete(taskId);
    }
    check(events) {
        const now = new Date();
        const recentEvents = events.slice(-this.config.contextSnapshotSize);
        // Check if any cron events are marked as missed
        const cronMissEvents = recentEvents.filter(e => e.type === 'cron_miss');
        for (const event of cronMissEvents) {
            return {
                triggered: true,
                alertType: 'cron_missed',
                severity: 'medium',
                message: `定时任务缺失：应该运行的任务 "${event.metadata?.jobName}" 没有触发`,
                details: {
                    jobName: event.metadata?.jobName,
                    jobId: event.metadata?.jobId,
                    expectedTime: event.metadata?.expectedTime,
                    timestamp: event.timestamp.toISOString(),
                },
                suggestedFix: [
                    '后台定时任务未按预期触发',
                    '检查 Cron/Heartbeat 配置是否正确',
                    '检查任务调度服务是否正常运行',
                    '查看 Agent 日志确认是否有错误',
                ].join('\n'),
            };
        }
        // Check for tasks that are overdue
        for (const [taskId, task] of this.scheduledTasks) {
            if (!task.expectedRunTime)
                continue;
            const overdueMs = now.getTime() - task.expectedRunTime.getTime();
            if (overdueMs > this.toleranceMs) {
                // Check if we actually got a cron event recently for this task
                const taskRanRecently = recentEvents.some(e => e.type === 'cron_trigger' && e.metadata?.jobId === taskId);
                if (!taskRanRecently) {
                    let severity;
                    if (overdueMs > this.toleranceMs * 6) {
                        severity = 'critical';
                    }
                    else if (overdueMs > this.toleranceMs * 3) {
                        severity = 'high';
                    }
                    else if (overdueMs > this.toleranceMs * 1.5) {
                        severity = 'medium';
                    }
                    else {
                        severity = 'low';
                    }
                    return {
                        triggered: true,
                        alertType: 'cron_missed',
                        severity,
                        message: `定时任务 "${task.name}" 超过预期时间 ${Math.round(overdueMs / 1000)} 秒未触发`,
                        details: {
                            taskId,
                            taskName: task.name,
                            intervalMs: task.intervalMs,
                            lastRunTime: task.lastRunTime?.toISOString(),
                            expectedRunTime: task.expectedRunTime.toISOString(),
                            overdueMs,
                            toleranceMs: this.toleranceMs,
                        },
                        suggestedFix: [
                            `定时任务 "${task.name}" 可能已失效`,
                            '检查任务调度器是否正常运行',
                            '确认 Agent 进程未被阻塞',
                            '考虑手动触发一次任务验证',
                        ].join('\n'),
                    };
                }
            }
        }
        return { triggered: false };
    }
    reset() {
        // Don't clear registered tasks on reset, just update expected times
        const now = new Date();
        for (const task of this.scheduledTasks.values()) {
            if (task.lastRunTime) {
                task.expectedRunTime = new Date(task.lastRunTime.getTime() + task.intervalMs);
            }
        }
    }
    /**
     * Set tolerance for missed cron detection (default 30 seconds)
     */
    setToleranceMs(ms) {
        this.toleranceMs = ms;
    }
}
exports.CronMissedDetector = CronMissedDetector;
//# sourceMappingURL=cronMissedDetector.js.map