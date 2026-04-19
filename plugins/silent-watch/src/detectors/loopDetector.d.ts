/**
 * Loop Detector
 * Detects when the same tool is called repeatedly without progress
 */
import { Detector, DetectorResult, MonitoringEvent } from '../types';
import { DetectorConfig } from '../config';
export declare class LoopDetector implements Detector {
    name: string;
    private config;
    private consecutiveSameResultCount;
    private lastToolResults;
    private alertedTools;
    constructor(config: DetectorConfig);
    check(events: MonitoringEvent[]): DetectorResult;
    reset(): void;
}
