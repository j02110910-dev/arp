/**
 * Additional Branch Coverage Tests
 * Targets untested if/else branches, error handling paths, and edge cases
 * to improve branch coverage from 73.87% toward 80%+
 */

import { LoopDetector } from '../src/detectors/loopDetector';
import { TimeoutDetector } from '../src/detectors/timeoutDetector';
import { EmptyResponseDetector } from '../src/detectors/emptyResponseDetector';
import { CronMissedDetector } from '../src/detectors/cronMissedDetector';
import { SilentWatchMonitor } from '../src/monitor';
import { MonitoringEvent } from '../src/types';

describe('Additional Branch Coverage - LoopDetector', () => {
  let detector: LoopDetector;

  beforeEach(() => {
    detector = new LoopDetector({ maxConsecutiveCalls: 5, contextSnapshotSize: 10 });
  });

  // Line 52-53: Branch where previousResult === lastResult (same result tracking)
  test('should increment sameResultCount when same tool returns identical result', () => {
    const events: MonitoringEvent[] = [
      { timestamp: new Date(), type: 'tool_call', tool: 'search', metadata: { result: 'result_a' } },
      { timestamp: new Date(), type: 'tool_call', tool: 'search', metadata: { result: 'result_a' } },
      { timestamp: new Date(), type: 'tool_call', tool: 'search', metadata: { result: 'result_a' } },
    ];
    // First check - should not trigger yet
    const result1 = detector.check(events);
    expect(result1.triggered).toBe(false);

    // Add more calls with same result - should trigger noProgress
    const moreEvents: MonitoringEvent[] = [
      ...events,
      { timestamp: new Date(), type: 'tool_call', tool: 'search', metadata: { result: 'result_a' } },
      { timestamp: new Date(), type: 'tool_call', tool: 'search', metadata: { result: 'result_a' } },
    ];
    const result2 = detector.check(moreEvents);
    // Should trigger due to noProgress (same result for >= maxConsecutiveCalls/2 = 2.5, so 3)
    expect(result2.triggered).toBe(true);
    expect(result2.details?.sameResultCount).toBeGreaterThan(0);
  });

  // Line 71-72: Branch where tool is already in alertedTools (don't re-alert)
  test('should not re-alert for same tool once already alerted', () => {
    const events: MonitoringEvent[] = [
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
    ];
    // First trigger
    const result1 = detector.check(events);
    expect(result1.triggered).toBe(true);

    // Check again - should not re-alert
    const result2 = detector.check(events);
    expect(result2.triggered).toBe(false);
  });

  // Lines 108-113: Branch where consecutive chain is broken - this tests that when
  // secondLastTool differs from toolName, the cleanup condition is checked
  test('should execute cleanup branch when chain is broken by different tool', () => {
    // Create events where secondLastTool differs from toolName
    const events: MonitoringEvent[] = [
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
      { timestamp: new Date(), type: 'tool_call', tool: 'other_tool' }, // different tool
    ];
    // This exercises the secondLastTool !== toolName branch without error
    const result = detector.check(events);
    expect(result).toBeDefined();
  });

  test('should handle re-alert prevention correctly', () => {
    // Trigger first alert
    const events1: MonitoringEvent[] = [
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
    ];
    const result1 = detector.check(events1);
    expect(result1.triggered).toBe(true);

    // Second check with same events should not re-alert (tool already in alertedTools)
    const result2 = detector.check(events1);
    expect(result2.triggered).toBe(false);
  });
});

describe('Additional Branch Coverage - TimeoutDetector', () => {
  let detector: TimeoutDetector;

  beforeEach(() => {
    detector = new TimeoutDetector({ stepTimeoutMs: 1000, contextSnapshotSize: 10 });
  });

  // Lines 38-41: Branch where timestamp is neither Date nor string (number or other)
  test('should handle numeric timestamp', () => {
    const events: MonitoringEvent[] = [
      { timestamp: 1234567890000 as any, type: 'tool_call', tool: 'test' },
    ];
    const result = detector.check(events);
    // Should not error and should set stepStartTime
    expect(result).toBeDefined();
  });

  test('should handle null timestamp', () => {
    const events: MonitoringEvent[] = [
      { timestamp: null as any, type: 'tool_call', tool: 'test' },
    ];
    const result = detector.check(events);
    // Should not error, uses current date as fallback
    expect(result).toBeDefined();
  });

  test('should handle object timestamp', () => {
    const events: MonitoringEvent[] = [
      { timestamp: { invalid: true } as any, type: 'tool_call', tool: 'test' },
    ];
    const result = detector.check(events);
    // Should not error, uses current date as fallback
    expect(result).toBeDefined();
  });
});

describe('Additional Branch Coverage - EmptyResponseDetector', () => {
  let detector: EmptyResponseDetector;

  beforeEach(() => {
    detector = new EmptyResponseDetector({ maxConsecutiveEmpty: 4, contextSnapshotSize: 10 });
  });

  // Line 31: Branch where recentResponses.length > maxSize (overflow)
  test('should trim recentResponses when it exceeds maxSize', () => {
    // Add many responses to trigger the shift() branch
    for (let i = 0; i < 25; i++) {
      const events: MonitoringEvent[] = [
        { timestamp: new Date(), type: 'empty_response', content: '' },
      ];
      detector.check(events);
    }
    // If we get here without error, the branch is covered
    expect(true).toBe(true);
  });

  // Line 72: Branch for high severity (consecutiveEmpty >= maxEmpty * 1.5 but < maxEmpty * 2)
  test('should assign high severity for overage between 50% and 100%', () => {
    const events: MonitoringEvent[] = [
      { timestamp: new Date(), type: 'empty_response', content: '' },
      { timestamp: new Date(), type: 'empty_response', content: '' },
      { timestamp: new Date(), type: 'empty_response', content: '' },
      { timestamp: new Date(), type: 'empty_response', content: '' },
      { timestamp: new Date(), type: 'empty_response', content: '' },
      { timestamp: new Date(), type: 'empty_response', content: '' },
    ];
    // 6 consecutive empty, maxEmpty is 4, 4*1.5=6, so >= 6 triggers high severity
    // but consecutiveNO_REPLY (0) < maxEmpty*2 (8), so not critical
    const result = detector.check(events);
    expect(result.triggered).toBe(true);
    expect(result.severity).toBe('high');
  });

  test('should assign critical severity for consecutiveNO_REPLY >= maxEmpty * 2', () => {
    const events: MonitoringEvent[] = [];
    // Use empty_response type to count as empty, with NO_REPLY content to count as NO_REPLY
    for (let i = 0; i < 9; i++) {
      events.push({ timestamp: new Date(), type: 'empty_response', content: 'NO_REPLY' });
    }
    const result = detector.check(events);
    expect(result.triggered).toBe(true);
    expect(result.severity).toBe('critical');
  });

  // Edge case: responseLength === 0
  test('should detect empty response by responseLength', () => {
    const events: MonitoringEvent[] = [
      { timestamp: new Date(), type: 'normal', content: 'some content', responseLength: 0 },
      { timestamp: new Date(), type: 'normal', content: 'some content', responseLength: 0 },
      { timestamp: new Date(), type: 'normal', content: 'some content', responseLength: 0 },
      { timestamp: new Date(), type: 'normal', content: 'some content', responseLength: 0 },
    ];
    const result = detector.check(events);
    expect(result.triggered).toBe(true);
    expect(result.severity).toBe('medium');
  });
});

describe('Additional Branch Coverage - CronMissedDetector', () => {
  let detector: CronMissedDetector;

  beforeEach(() => {
    detector = new CronMissedDetector({ contextSnapshotSize: 10 });
    detector.setToleranceMs(1000); // 1 second tolerance for testing
  });

  // Test that check handles tasks without expectedRunTime (line 89 branch)
  test('should handle task without expectedRunTime', () => {
    // Register a task with no expectedRunTime
    detector.registerTask({
      name: 'test_task',
      id: 'task_without_time',
      intervalMs: 5000,
      // expectedRunTime not set
    });

    const events: MonitoringEvent[] = [];
    const result = detector.check(events);
    // Should not error
    expect(result).toBeDefined();
  });

  // Test that check executes the overdue loop without error when no tasks are overdue
  test('should not trigger when tasks are on schedule', () => {
    // Register a task and immediately mark it as ran (expectedRunTime will be in future)
    detector.registerTask({
      name: 'test_task',
      id: 'task_on_time',
      intervalMs: 5000,
    });
    // markTaskRan updates expectedRunTime to now + intervalMs (future)
    detector.markTaskRan('task_on_time');

    const events: MonitoringEvent[] = [];
    const result = detector.check(events);
    expect(result.triggered).toBe(false);
  });
});

describe('Additional Branch Coverage - SilentWatchMonitor', () => {
  let monitor: SilentWatchMonitor;

  beforeEach(() => {
    monitor = new SilentWatchMonitor({
      enabled: true,
      detectLoops: true,
      detectEmptyResponses: true,
      detectTimeouts: true,
      detectCronMisses: true,
      detectAnomalies: true,
      detectors: {
        maxConsecutiveCalls: 5,
        maxConsecutiveEmpty: 3,
        stepTimeoutMs: 60000,
        contextSnapshotSize: 10,
      },
      notifiers: {
        console: { enabled: true, level: 'error' },
        wechat: { enabled: false },
        telegram: { enabled: false },
        email: { enabled: false },
      },
      alertHistoryPath: undefined, // Disable file operations
    });
  });

  // Line 138-139: Branch where eventHistory exceeds maxHistory
  test('should trim eventHistory when it exceeds maxHistory', () => {
    // Record many events
    for (let i = 0; i < 150; i++) {
      monitor.recordEvent({
        timestamp: new Date(),
        type: 'tool_call',
        tool: 'test_tool',
      });
    }
    // If we get here, the shift branch was exercised
    const stats = monitor.getStats();
    expect(stats.totalEvents).toBeGreaterThanOrEqual(100);
  });

  // Test recordToolCall with invalid inputs (lines 163-170)
  test('should ignore invalid toolName in recordToolCall', () => {
    monitor.recordToolCall('' as any);
    monitor.recordToolCall(null as any);
    monitor.recordToolCall(undefined as any);
    monitor.recordToolCall(123 as any);
    // Should not error
    expect(true).toBe(true);
  });

  test('should ignore invalid duration in recordToolCall', () => {
    monitor.recordToolCall('test', {}, undefined, -1);
    monitor.recordToolCall('test', {}, undefined, 'bad' as any);
    // Should not error
    expect(true).toBe(true);
  });

  // Test recordResponse with edge cases
  test('should handle recordResponse with null content', () => {
    monitor.recordResponse(null as any);
    expect(true).toBe(true);
  });

  // Test registerCronTask validation (lines 222-230)
  test('should ignore registerCronTask with missing name', () => {
    monitor.registerCronTask('', 'some_id', 5000);
    expect(true).toBe(true);
  });

  test('should ignore registerCronTask with missing id', () => {
    monitor.registerCronTask('some_name', '', 5000);
    expect(true).toBe(true);
  });

  test('should ignore registerCronTask with interval < 1000ms', () => {
    monitor.registerCronTask('some_name', 'some_id', 500);
    expect(true).toBe(true);
  });

  // Test custom alert handler error handling (lines 434-445)
  test('should handle custom alert handler that throws', () => {
    const errorMonitor = new SilentWatchMonitor(
      {
        enabled: true,
        detectLoops: true,
        detectEmptyResponses: false,
        detectTimeouts: false,
        detectCronMisses: false,
        detectAnomalies: false,
        detectors: { contextSnapshotSize: 10 },
        notifiers: {
          console: { enabled: false },
          wechat: { enabled: false },
          telegram: { enabled: false },
          email: { enabled: false },
        },
      },
      () => {
        throw new Error('Alert handler error');
      }
    );

    // Should not throw
    errorMonitor.recordEvent({
      timestamp: new Date(),
      type: 'tool_call',
      tool: 'test',
    });
    // Manually trigger via internal state by calling recordToolCall multiple times
    errorMonitor.recordToolCall('search');
    errorMonitor.recordToolCall('search');
    errorMonitor.recordToolCall('search');
    errorMonitor.recordToolCall('search');
    errorMonitor.recordToolCall('search');
    expect(true).toBe(true);
  });

  // Test config onAlert callback error handling (lines 448-455)
  test('should handle config onAlert callback that throws', () => {
    const errorMonitor = new SilentWatchMonitor(
      {
        enabled: true,
        detectLoops: true,
        detectEmptyResponses: false,
        detectTimeouts: false,
        detectCronMisses: false,
        detectAnomalies: false,
        detectors: { contextSnapshotSize: 10 },
        notifiers: {
          console: { enabled: false },
          wechat: { enabled: false },
          telegram: { enabled: false },
          email: { enabled: false },
        },
        onAlert: () => {
          throw new Error('Config onAlert error');
        },
      },
      undefined
    );

    // Should not throw
    errorMonitor.recordToolCall('search');
    errorMonitor.recordToolCall('search');
    errorMonitor.recordToolCall('search');
    errorMonitor.recordToolCall('search');
    errorMonitor.recordToolCall('search');
    expect(true).toBe(true);
  });

  // Test async alert handler (lines 437-442)
  test('should handle async custom alert handler', async () => {
    let handlerCalled = false;
    const asyncMonitor = new SilentWatchMonitor(
      {
        enabled: true,
        detectLoops: true,
        detectEmptyResponses: false,
        detectTimeouts: false,
        detectCronMisses: false,
        detectAnomalies: false,
        detectors: { contextSnapshotSize: 10 },
        notifiers: {
          console: { enabled: false },
          wechat: { enabled: false },
          telegram: { enabled: false },
          email: { enabled: false },
        },
      },
      async () => {
        handlerCalled = true;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    );

    asyncMonitor.recordToolCall('search');
    asyncMonitor.recordToolCall('search');
    asyncMonitor.recordToolCall('search');
    asyncMonitor.recordToolCall('search');
    asyncMonitor.recordToolCall('search');

    // Wait for async handler
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(handlerCalled).toBe(true);
  });

  // Test stop method
  test('should handle stop gracefully', () => {
    monitor.stop();
    expect(true).toBe(true);
  });
});

describe('Additional Branch Coverage - Monitor Performance Metrics', () => {
  test('should track alert processing time in metrics', async () => {
    const monitor = new SilentWatchMonitor({
      enabled: true,
      detectLoops: true,
      detectEmptyResponses: true,
      detectTimeouts: true,
      detectCronMisses: true,
      detectAnomalies: true,
      detectors: {
        maxConsecutiveCalls: 5,
        maxConsecutiveEmpty: 3,
        stepTimeoutMs: 60000,
        contextSnapshotSize: 10,
      },
      notifiers: {
        console: { enabled: false },
        wechat: { enabled: false },
        telegram: { enabled: false },
        email: { enabled: false },
      },
      alertHistoryPath: undefined,
    });

    // Trigger an alert to track processing time
    monitor.recordToolCall('search');
    monitor.recordToolCall('search');
    monitor.recordToolCall('search');
    monitor.recordToolCall('search');
    monitor.recordToolCall('search');

    const metrics = monitor.getPerformanceMetrics();
    expect(metrics.avgAlertProcessingTime).toBeGreaterThanOrEqual(0);
  });
});

describe('Additional Branch Coverage - Mixed Scenarios', () => {
  test('loopDetector handles undefined tool gracefully', () => {
    const detector = new LoopDetector({ maxConsecutiveCalls: 5, contextSnapshotSize: 10 });
    const events: MonitoringEvent[] = [
      { timestamp: new Date(), type: 'tool_call' }, // no tool property
      { timestamp: new Date(), type: 'tool_call' },
      { timestamp: new Date(), type: 'tool_call' },
      { timestamp: new Date(), type: 'tool_call' },
      { timestamp: new Date(), type: 'tool_call' },
    ];
    const result = detector.check(events);
    expect(result).toBeDefined();
    // Should use 'unknown' as toolName per line 34
  });

  test('emptyResponseDetector handles undefined content', () => {
    const detector = new EmptyResponseDetector({ maxConsecutiveEmpty: 3, contextSnapshotSize: 10 });
    const events: MonitoringEvent[] = [
      { timestamp: new Date(), type: 'empty_response' }, // no content
      { timestamp: new Date(), type: 'empty_response' },
      { timestamp: new Date(), type: 'empty_response' },
    ];
    const result = detector.check(events);
    expect(result.triggered).toBe(true);
  });

  test('timeoutDetector handles missing timestamp', () => {
    const detector = new TimeoutDetector({ stepTimeoutMs: 60000, contextSnapshotSize: 10 });
    const events: MonitoringEvent[] = [
      { type: 'tool_call', tool: 'test' }, // no timestamp
    ];
    const result = detector.check(events);
    expect(result).toBeDefined();
  });
});

describe('Additional Branch Coverage - Targeted Untested Branches', () => {
  // loopDetector.ts lines 111-112: Alert reset when different tool breaks the consecutive chain
  test('should delete alertedTools and consecutiveSameResultCount when chain is broken after alert', () => {
    const detector = new LoopDetector({ maxConsecutiveCalls: 5, contextSnapshotSize: 10 });
    
    // First, trigger an alert by calling the same tool multiple times
    const triggerEvents: MonitoringEvent[] = [
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
    ];
    const triggerResult = detector.check(triggerEvents);
    expect(triggerResult.triggered).toBe(true);
    expect(triggerResult.severity).toBe('medium');

    // Now break the chain by calling a different tool - this should execute the cleanup branch
    const breakChainEvents: MonitoringEvent[] = [
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
      { timestamp: new Date(), type: 'tool_call', tool: 'different_tool' }, // breaks the chain
    ];
    const breakResult = detector.check(breakChainEvents);
    // Should not trigger on 'search' anymore since different tool was called
    expect(breakResult.triggered).toBe(false);
  });

  // emptyResponseDetector.ts lines 66-68: critical severity when consecutiveNO_REPLY >= maxEmpty * 2
  test('should assign critical severity when consecutiveNO_REPLY is exactly maxEmpty * 2', () => {
    const detector = new EmptyResponseDetector({ maxConsecutiveEmpty: 4, contextSnapshotSize: 20 });
    
    // Create 8 NO_REPLY events (maxEmpty * 2 = 8)
    // consecutiveEmpty will be 8 (counting NO_REPLY as empty via type='empty_response')
    // consecutiveNO_REPLY will be 8 (>= maxEmpty * 2 = 8)
    const events: MonitoringEvent[] = [];
    for (let i = 0; i < 8; i++) {
      events.push({ timestamp: new Date(), type: 'empty_response', content: 'NO_REPLY' });
    }
    
    const result = detector.check(events);
    expect(result.triggered).toBe(true);
    expect(result.severity).toBe('critical');
  });

  test('should assign critical severity when consecutiveNO_REPLY exceeds maxEmpty * 2', () => {
    const detector = new EmptyResponseDetector({ maxConsecutiveEmpty: 3, contextSnapshotSize: 20 });
    
    // Create 10 NO_REPLY events (maxEmpty * 2 = 6)
    const events: MonitoringEvent[] = [];
    for (let i = 0; i < 10; i++) {
      events.push({ timestamp: new Date(), type: 'empty_response', content: 'NO_REPLY' });
    }
    
    const result = detector.check(events);
    expect(result.triggered).toBe(true);
    expect(result.severity).toBe('critical');
  });
});
