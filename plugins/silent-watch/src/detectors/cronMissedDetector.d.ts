/**
 * Cron Missed Detector
 * Detects when scheduled/heartbeat tasks fail to trigger
 */
import { Detector, DetectorResult, MonitoringEvent } from '../types';
import { DetectorConfig } from '../config';
export interface ScheduledTask {
    name: string;
    id: string;
    intervalMs: number;
    lastRunTime?: Date;
    expectedRunTime?: Date;
}
export declare class CronMissedDetector implements Detector {
    name: string;
    private config;
    private scheduledTasks;
    private toleranceMs;
    constructor(config: DetectorConfig);
    /**
     * Register a scheduled task to monitor
     */
    registerTask(task: ScheduledTask): void;
    /**
     * Mark a task as run (call this when your cron/heartbeat fires)
     */
    markTaskRan(taskId: string): void;
    /**
     * Unregister a task
     */
    unregisterTask(taskId: string): void;
    check(events: MonitoringEvent[]): DetectorResult;
    reset(): void;
    /**
     * Set tolerance for missed cron detection (default 30 seconds)
     */
    setToleranceMs(ms: number): void;
}
