/**
 * Timeout Detector
 * Detects when a single step/operation exceeds the expected timeout
 */

import { Detector, DetectorResult, MonitoringEvent } from '../types';
import { DetectorConfig } from '../config';

export class TimeoutDetector implements Detector {
  name = 'timeout_detector';

  private config: DetectorConfig;
  private stepStartTime?: Date;
  private lastEventType?: string;

  constructor(config: DetectorConfig) {
    this.config = {
      stepTimeoutMs: config.stepTimeoutMs || 60000, // 60 seconds default
      contextSnapshotSize: config.contextSnapshotSize || 10,
    };
  }

  check(events: MonitoringEvent[]): DetectorResult {
    if (events.length === 0) {
      return { triggered: false };
    }

    const lastEvent = events[events.length - 1];
    const now = new Date();

    // Track step boundaries
    // Each tool_call starts a new step - reset timer for every tool_call
    if (lastEvent.type === 'tool_call') {
      // New step started, reset timer
      // Ensure timestamp is a Date object (may be string from external sources)
      if (lastEvent.timestamp instanceof Date) {
        this.stepStartTime = lastEvent.timestamp;
      } else if (typeof lastEvent.timestamp === 'string') {
        this.stepStartTime = new Date(lastEvent.timestamp);
      } else {
        this.stepStartTime = new Date();
      }
    }

    this.lastEventType = lastEvent.type;

    // If we have a step in progress, check if it's timed out
    if (this.stepStartTime && lastEvent.type === 'tool_call') {
      const elapsed = now.getTime() - this.stepStartTime.getTime();
      const timeout = this.config.stepTimeoutMs!;

      if (elapsed > timeout) {
        // Calculate how far past the timeout
        const overage = elapsed - timeout;
        const overagePercent = Math.round((overage / timeout) * 100);

        let severity: 'low' | 'medium' | 'high' | 'critical';
        switch (true) {
          case overagePercent > 300:
            severity = 'critical';
            break;
          case overagePercent > 150:
            severity = 'high';
            break;
          case overagePercent > 50:
            severity = 'medium';
            break;
          default:
            severity = 'low';
            break;
        }

        return {
          triggered: true,
          alertType: 'timeout',
          severity,
          message: `超时告警：单步操作已运行 ${Math.round(elapsed / 1000)} 秒（超时阈值 ${timeout / 1000} 秒）`,
          details: {
            toolName: lastEvent.tool,
            elapsedMs: elapsed,
            timeoutMs: timeout,
            overageMs: overage,
            overagePercent,
            stepStartTime: this.stepStartTime.toISOString(),
          },
          suggestedFix: [
            '单步操作超时，可能 API 响应缓慢或已挂起',
            `工具 "${lastEvent.tool}" 可能需要检查`,
            '检查网络连接和 API 服务状态',
            `可设置 SILENT_WATCH_STEP_TIMEOUT_MS 环境变量来调整阈值（单位：毫秒）`,
          ].join('\n'),
        };
      }
    }

    return { triggered: false };
  }

  reset(): void {
    this.stepStartTime = undefined;
    this.lastEventType = undefined;
  }
}
