/**
 * Empty Response Detector
 * Detects when agent returns empty or NO_REPLY responses consecutively
 */
import { Detector, DetectorResult, MonitoringEvent } from '../types';
import { DetectorConfig } from '../config';
export declare class EmptyResponseDetector implements Detector {
    name: string;
    private config;
    private recentResponses;
    constructor(config: DetectorConfig);
    check(events: MonitoringEvent[]): DetectorResult;
    reset(): void;
}
