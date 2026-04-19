/**
 * Timeout Detector
 * Detects when a single step/operation exceeds the expected timeout
 */
import { Detector, DetectorResult, MonitoringEvent } from '../types';
import { DetectorConfig } from '../config';
export declare class TimeoutDetector implements Detector {
    name: string;
    private config;
    private stepStartTime?;
    private lastEventType?;
    constructor(config: DetectorConfig);
    check(events: MonitoringEvent[]): DetectorResult;
    reset(): void;
}
