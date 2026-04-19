/**
 * Anomaly Detector
 * Detects anomalous behavior patterns like evasive language, repetition, behavior drift
 */
import { Detector, DetectorResult, MonitoringEvent } from '../types';
import { DetectorConfig } from '../config';
export declare class AnomalyDetector implements Detector {
    name: string;
    private config;
    private maxHistorySize;
    constructor(config: DetectorConfig);
    check(events: MonitoringEvent[]): DetectorResult;
    reset(): void;
}
