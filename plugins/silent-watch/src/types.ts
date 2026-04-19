/**
 * SilentWatch - Type Definitions
 */

import { Alert, AlertContext, AlertType, MonitoringEvent, EventType, DetectorConfig, NotifierConfig, loadConfig, getDefaultConfigPath, DEFAULT_CONFIG, } from './config';

// Export detector interfaces
export interface Detector {
  name: string;
  check(events: MonitoringEvent[]): DetectorResult;
  reset(): void;
}

export interface DetectorResult {
  triggered: boolean;
  alertType?: AlertType;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  message?: string;
  details?: Record<string, unknown>;
  suggestedFix?: string;
}

// Export monitor types
export type AlertHandler = (alert: Alert) => Promise<void> | void;

export interface MonitorStats {
  totalEvents: number;
  totalAlerts: number;
  uptimeSeconds: number;
  lastEventTime?: Date;
  lastAlertTime?: Date;
  alertsByType: {
    loop_detected: number;
    empty_response: number;
    timeout: number;
    cron_missed: number;
    anomaly: number;
  };
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  lastCheck: Date;
  detectors: Record<string, 'active' | 'inactive' | 'error'>;
  notifiers: Record<string, 'active' | 'inactive' | 'error'>;
}

export interface PerformanceMetrics {
  avgEventProcessingTime: number;
  avgAlertProcessingTime: number;
  totalEventsProcessed: number;
  memoryUsage?: NodeJS.MemoryUsage;
}

export interface AgentSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  events: MonitoringEvent[];
}

export interface ToolCallEvent {
  timestamp: Date;
  tool: string;
  duration?: number;
  args?: Record<string, unknown>;
  result?: unknown;
}

export interface ResponseEvent {
  timestamp: Date;
  content: string;
  responseLength?: number;
}

export interface CronEvent {
  timestamp: Date;
  jobName: string;
  jobId: string;
  expectedRunTime?: Date;
}

// Re-export for convenience
export { Alert, AlertContext, AlertType, MonitoringEvent, EventType, loadConfig, getDefaultConfigPath, DEFAULT_CONFIG };
export type { SilentWatchConfig } from './config';
