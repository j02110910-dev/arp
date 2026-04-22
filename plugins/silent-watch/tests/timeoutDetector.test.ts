/**
 * TimeoutDetector Tests
 */

import { TimeoutDetector } from '../src/detectors/timeoutDetector';
import { MonitoringEvent } from '../src/types';

describe('TimeoutDetector', () => {
  let detector: TimeoutDetector;

  beforeEach(() => {
    detector = new TimeoutDetector({
      stepTimeoutMs: 5000, // 5 seconds for easier testing
      contextSnapshotSize: 10,
    });
  });

  afterEach(() => {
    detector.reset();
  });

  function createToolCallEvent(toolName: string, timestamp: Date): MonitoringEvent {
    return {
      timestamp,
      type: 'tool_call',
      tool: toolName,
      duration: 1000,
    };
  }

  it('should not trigger with no events', () => {
    const result = detector.check([]);
    expect(result.triggered).toBe(false);
  });

  it('should not trigger when tool call is within timeout', () => {
    const now = new Date();
    const recentEvent = createToolCallEvent('test_tool', new Date(now.getTime() - 1000));
    const result = detector.check([recentEvent]);
    expect(result.triggered).toBe(false);
  });

  it('should trigger when tool call exceeds timeout', () => {
    const now = new Date();
    // Create an event that started 6 seconds ago (exceeds 5 second timeout)
    const oldEvent = createToolCallEvent('test_tool', new Date(now.getTime() - 6000));
    const result = detector.check([oldEvent]);
    expect(result.triggered).toBe(true);
    expect(result.alertType).toBe('timeout');
    expect(result.severity).toBe('low'); // just slightly over
  });

  it('should trigger with medium severity when overage > 50%', () => {
    const now = new Date();
    // Create an event that started 8 seconds ago (overage = 3000ms, timeout = 5000ms, overage% = 60%)
    const oldEvent = createToolCallEvent('test_tool', new Date(now.getTime() - 8000));
    const result = detector.check([oldEvent]);
    expect(result.triggered).toBe(true);
    expect(result.severity).toBe('medium');
  });

  it('should trigger with high severity when overage > 150%', () => {
    const now = new Date();
    // Create an event that started 13 seconds ago (overage = 8000ms, timeout = 5000ms, overage% = 160%)
    const oldEvent = createToolCallEvent('test_tool', new Date(now.getTime() - 13000));
    const result = detector.check([oldEvent]);
    expect(result.triggered).toBe(true);
    expect(result.severity).toBe('high');
  });

  it('should trigger with critical severity when overage > 300%', () => {
    const now = new Date();
    // Create an event that started 21 seconds ago (overage = 16000ms, timeout = 5000ms, overage% = 320%)
    const oldEvent = createToolCallEvent('test_tool', new Date(now.getTime() - 21000));
    const result = detector.check([oldEvent]);
    expect(result.triggered).toBe(true);
    expect(result.severity).toBe('critical');
  });

  it('should include details in result', () => {
    const now = new Date();
    const oldEvent = createToolCallEvent('slow_tool', new Date(now.getTime() - 10000));
    const result = detector.check([oldEvent]);
    expect(result.triggered).toBe(true);
    expect(result.details).toHaveProperty('toolName', 'slow_tool');
    expect(result.details).toHaveProperty('elapsedMs');
    expect(result.details).toHaveProperty('timeoutMs', 5000);
    expect(result.details).toHaveProperty('overageMs');
    expect(result.suggestedFix).toBeDefined();
  });

  it('should reset state correctly', () => {
    const now = new Date();
    const oldEvent = createToolCallEvent('test_tool', new Date(now.getTime() - 10000));
    detector.check([oldEvent]);
    
    detector.reset();
    
    // After reset, should not trigger with a fresh event
    const newEvent = createToolCallEvent('test_tool', new Date());
    const result = detector.check([newEvent]);
    expect(result.triggered).toBe(false);
  });

  it('should use default timeout when not configured', () => {
    const defaultDetector = new TimeoutDetector({});
    expect(defaultDetector).toBeDefined();
  });
});
