/**
 * AnomalyDetector Tests
 */

import { AnomalyDetector } from '../src/detectors/anomalyDetector';
import { MonitoringEvent } from '../src/types';

describe('AnomalyDetector', () => {
  let detector: AnomalyDetector;

  beforeEach(() => {
    detector = new AnomalyDetector({
      contextSnapshotSize: 10,
    });
  });

  function createResponseEvent(content: string): MonitoringEvent {
    return {
      timestamp: new Date(),
      type: 'normal',
      content,
    };
  }

  function createEmptyResponseEvent(content: string = ''): MonitoringEvent {
    return {
      timestamp: new Date(),
      type: 'empty_response',
      content,
    };
  }

  it('should not trigger with no events', () => {
    const result = detector.check([]);
    expect(result.triggered).toBe(false);
  });

  it('should not trigger with normal content', () => {
    const events = [
      createResponseEvent('Hello, how can I help you today?'),
      createResponseEvent('The weather is sunny.'),
    ];
    const result = detector.check(events);
    expect(result.triggered).toBe(false);
  });

  it('should trigger with evasive language patterns', () => {
    // Need 3+ evasive patterns to trigger (evasiveScore >= 3)
    const events = [
      createResponseEvent('好的好的'),
      createResponseEvent('收到收到'),
      createResponseEvent('没问题没问题'),
    ];
    const result = detector.check(events);
    expect(result.triggered).toBe(true);
    expect(result.alertType).toBe('anomaly');
    // totalScore = 3, so severity = 'low' (not >= 5)
    expect(result.severity).toBe('low');
  });

  it('should trigger with loop indicators', () => {
    const events = [
      createResponseEvent('让我再想想'),
      createResponseEvent('我再重新试试'),
      createResponseEvent('让我重新开始'),
    ];
    const result = detector.check(events);
    expect(result.triggered).toBe(true);
    expect(result.alertType).toBe('anomaly');
  });

  it('should trigger with fabrication indicators', () => {
    // Need 3+ fabrication patterns to trigger (fabricationScore >= 3)
    const events = [
      createResponseEvent('任务已完成'),
      createResponseEvent('已成功处理'),
      createResponseEvent('已经搞定了'),
    ];
    const result = detector.check(events);
    expect(result.triggered).toBe(true);
    expect(result.alertType).toBe('anomaly');
    // totalScore = 3, severity = 'low'
    expect(result.severity).toBe('low');
  });

  it('should trigger with high severity for total score >= 10', () => {
    const events = [
      createResponseEvent('好的好的'),
      createResponseEvent('让我再想想'),
      createResponseEvent('已完成'),
      createResponseEvent('没问题没问题'),
      createResponseEvent('让我重新'),
      createResponseEvent('已成功'),
      createResponseEvent('我明白了我明白了'),
      createResponseEvent('我再试'),
    ];
    const result = detector.check(events);
    expect(result.triggered).toBe(true);
    expect(result.severity).toBe('critical');
  });

  it('should trigger with severity based on total score (>= 5 is medium)', () => {
    // Mix of patterns to get totalScore >= 5 but evasiveScore < 3
    const events = [
      createResponseEvent('好的好的'), // evasive
      createResponseEvent('让我再想想'), // evasive + loop
      createResponseEvent('我明白了我明白了'), // evasive
      createResponseEvent('让我再试一次'), // evasive + loop
    ];
    const result = detector.check(events);
    expect(result.triggered).toBe(true);
    // totalScore should be 6 (4 evasive + 2 loop), severity >= 5 is medium
    expect(result.severity).toBe('medium');
  });

  it('should trigger with medium severity for total score 5-6', () => {
    const events = [
      createResponseEvent('好的好的'),
      createResponseEvent('收到收到'),
      createResponseEvent('让我再想想'),
      createResponseEvent('让我重新'),
    ];
    const result = detector.check(events);
    expect(result.triggered).toBe(true);
    // totalScore = 4 evasive + 2 loop = 6, severity = medium
    expect(result.severity).toBe('medium');
  });

  it('should trigger with high severity for total score 7-9', () => {
    const events = [
      createResponseEvent('好的好的'),
      createResponseEvent('收到收到'),
      createResponseEvent('让我再想想'),
      createResponseEvent('让我重新'),
      createResponseEvent('没问题没问题'),
      createResponseEvent('让我再试'),
    ];
    const result = detector.check(events);
    expect(result.triggered).toBe(true);
    // totalScore = 5 evasive + 3 loop = 8, severity = high
    expect(result.severity).toBe('high');
  });

  it('should trigger with low severity for content repetition >= 3 with 5+ events', () => {
    const repeatedContent = '这是一段重复的内容来满足长度要求';
    const events = [
      createResponseEvent(repeatedContent),
      createResponseEvent(repeatedContent),
      createResponseEvent(repeatedContent),
      createResponseEvent('其他不同的内容'),
      createResponseEvent('再来一些不同的'),
    ];
    const result = detector.check(events);
    expect(result.triggered).toBe(true);
    expect(result.severity).toBe('low');
  });

  it('should not trigger for short repeated content (< 10 chars)', () => {
    const events = [
      createResponseEvent('hi'),
      createResponseEvent('hi'),
      createResponseEvent('hi'),
      createResponseEvent('hello'),
      createResponseEvent('world'),
    ];
    const result = detector.check(events);
    expect(result.triggered).toBe(false);
  });

  it('should include details in result when triggered', () => {
    const events = [
      createResponseEvent('好的好的，让我再想想'),
      createResponseEvent('好的好的'),
      createResponseEvent('好的好的'),
    ];
    const result = detector.check(events);
    expect(result.triggered).toBe(true);
    expect(result.details).toHaveProperty('evasiveScore');
    expect(result.details).toHaveProperty('loopScore');
    expect(result.details).toHaveProperty('fabricationScore');
    expect(result.details).toHaveProperty('totalScore');
  });

  it('should reset correctly', () => {
    const events = [
      createResponseEvent('好的好的，好的好的，好的好的'),
    ];
    detector.check(events);
    detector.reset();
    // No state to reset, so result should still be false for new content
    const newEvents = [createResponseEvent('正常的回应')];
    const result = detector.check(newEvents);
    expect(result.triggered).toBe(false);
  });

  it('should use default config when not provided', () => {
    const defaultDetector = new AnomalyDetector({});
    expect(defaultDetector).toBeDefined();
  });

  it('should filter response events only for content analysis', () => {
    const events = [
      { timestamp: new Date(), type: 'tool_call' as const, tool: 'test' },
      createResponseEvent('好的好的'),
      createResponseEvent('好的好的'),
      createResponseEvent('好的好的'),
    ];
    const result = detector.check(events);
    // Should only consider response events
    expect(result.triggered).toBe(true);
  });
});
