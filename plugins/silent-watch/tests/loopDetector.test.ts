/**
 * LoopDetector Tests
 */

import { LoopDetector } from '../src/detectors/loopDetector';
import { MonitoringEvent } from '../src/types';

describe('LoopDetector', () => {
  let detector: LoopDetector;

  beforeEach(() => {
    detector = new LoopDetector({
      maxConsecutiveCalls: 5,
      contextSnapshotSize: 10,
    });
  });

  afterEach(() => {
    detector.reset();
  });

  function createToolCallEvent(toolName: string, result?: unknown): MonitoringEvent {
    return {
      timestamp: new Date(),
      type: 'tool_call',
      tool: toolName,
      duration: 100,
      metadata: result !== undefined ? { result } : undefined,
    };
  }

  it('should not trigger with no events', () => {
    const result = detector.check([]);
    expect(result.triggered).toBe(false);
  });

  it('should not trigger with different tools', () => {
    const events = [
      createToolCallEvent('tool_a'),
      createToolCallEvent('tool_b'),
      createToolCallEvent('tool_c'),
    ];
    const result = detector.check(events);
    expect(result.triggered).toBe(false);
  });

  it('should not trigger when same tool called below threshold', () => {
    const events = Array.from({ length: 4 }, (_, i) =>
      createToolCallEvent('search', { count: i })
    );
    const result = detector.check(events);
    expect(result.triggered).toBe(false);
  });

  it('should trigger when same tool called at threshold', () => {
    const events = Array.from({ length: 5 }, () =>
      createToolCallEvent('search', { count: 0 })
    );
    const result = detector.check(events);
    expect(result.triggered).toBe(true);
    expect(result.alertType).toBe('loop_detected');
    expect(result.severity).toBe('medium');
  });

  it('should trigger with high severity when exceeding 2x threshold', () => {
    const events = Array.from({ length: 11 }, () =>
      createToolCallEvent('search', { count: 0 })
    );
    const result = detector.check(events);
    expect(result.triggered).toBe(true);
    expect(result.severity).toBe('high');
  });

  it('should trigger with critical severity when exceeding 3x threshold', () => {
    const events = Array.from({ length: 16 }, () =>
      createToolCallEvent('search', { count: 0 })
    );
    const result = detector.check(events);
    expect(result.triggered).toBe(true);
    expect(result.severity).toBe('critical');
  });

  it('should include tool name and count in details', () => {
    const events = Array.from({ length: 6 }, () =>
      createToolCallEvent('my_tool', 'same_result')
    );
    const result = detector.check(events);
    expect(result.details).toHaveProperty('toolName', 'my_tool');
    expect(result.details).toHaveProperty('consecutiveCalls', 6);
  });

  it('should provide suggested fix in result', () => {
    const events = Array.from({ length: 6 }, () =>
      createToolCallEvent('test_tool', 'same')
    );
    const result = detector.check(events);
    expect(result.suggestedFix).toBeDefined();
    expect(result.suggestedFix).toContain('test_tool');
  });

  it('should reset state correctly', () => {
    const events = Array.from({ length: 6 }, () =>
      createToolCallEvent('search', 'same')
    );
    detector.check(events);

    detector.reset();

    // After reset, should not trigger immediately
    const newEvents = [createToolCallEvent('search', 'same')];
    const result = detector.check(newEvents);
    expect(result.triggered).toBe(false);
  });
});
