/**
 * Empty Response Detector
 * Detects when agent returns empty or NO_REPLY responses consecutively
 */

import { Detector, DetectorResult, MonitoringEvent } from '../types';
import { DetectorConfig } from '../config';

export class EmptyResponseDetector implements Detector {
  name = 'empty_response_detector';

  private config: DetectorConfig;
  private recentResponses: { content: string; isEmpty: boolean; isNO_REPLY: boolean }[] = [];

  constructor(config: DetectorConfig) {
    this.config = {
      maxConsecutiveEmpty: config.maxConsecutiveEmpty || 3,
      contextSnapshotSize: config.contextSnapshotSize || 10,
    };
    // Initialize recentResponses with the same snapshot size
    this.recentResponses = [];
  }

  /**
   * Track a response for consecutive empty response detection
   */
  private trackResponse(content: string, isEmpty: boolean, isNO_REPLY: boolean): void {
    this.recentResponses.push({ content, isEmpty, isNO_REPLY });
    const maxSize = (this.config.contextSnapshotSize || 10) * 2;
    if (this.recentResponses.length > maxSize) {
      this.recentResponses.shift();
    }
  }

  check(events: MonitoringEvent[]): DetectorResult {
    // Only consider response-type events, NOT tool_call/cron_trigger/etc.
    const responseEvents = events.filter(e =>
      e.type === 'normal' || e.type === 'empty_response'
    );

    const recentEvents = responseEvents.slice(-(this.config.contextSnapshotSize || 10));

    // Track consecutive empty responses from the end
    let consecutiveEmpty = 0;
    let consecutiveNO_REPLY = 0;

    for (let i = recentEvents.length - 1; i >= 0; i--) {
      const event = recentEvents[i];
      const isEmptyResponse = event.type === 'empty_response' ||
                              event.content === '' ||
                              (event.responseLength !== undefined && event.responseLength === 0);
      const isNO_REPLY = event.content === 'NO_REPLY';

      if (isEmptyResponse || isNO_REPLY) {
        if (isEmptyResponse) consecutiveEmpty++;
        if (isNO_REPLY) consecutiveNO_REPLY++;
        // Track response for potential use in reset()
        this.trackResponse(event.content || '', isEmptyResponse, isNO_REPLY);
      } else {
        // Found a meaningful response - stop counting
        break;
      }
    }

    // Trigger alert for consecutive empty responses
    if (consecutiveEmpty >= (this.config.maxConsecutiveEmpty || 3)) {
      let severity: 'low' | 'medium' | 'high' | 'critical';
      const maxEmpty = this.config.maxConsecutiveEmpty || 3;
      if (consecutiveNO_REPLY >= maxEmpty * 2) {
        severity = 'critical';
      } else if (consecutiveEmpty >= maxEmpty * 1.5) {
        severity = 'high';
      } else {
        severity = 'medium';
      }

      return {
        triggered: true,
        alertType: 'empty_response',
        severity,
        message: `静默失败：连续 ${consecutiveEmpty} 次无实质输出（可能已卡死）`,
        details: {
          consecutiveEmpty,
          consecutiveNO_REPLY,
          maxAllowed: this.config.maxConsecutiveEmpty,
          recentEventsCount: recentEvents.length,
        },
        suggestedFix: [
          'Agent 可能已陷入静默状态',
          '建议手动检查 Agent 运行状态',
          '考虑重启 Agent 会话',
          `可设置 SILENT_WATCH_MAX_CONSECUTIVE_EMPTY 环境变量来调整阈值`,
        ].join('\n'),
      };
    }

    return { triggered: false };
  }

  reset(): void {
    this.recentResponses = [];
  }
}
