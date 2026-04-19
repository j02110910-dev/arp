/**
 * EmptyResponseDetector Tests
 */

import { EmptyResponseDetector } from '../src/detectors/emptyResponseDetector';
import { MonitoringEvent } from '../src/types';

describe('EmptyResponseDetector', () => {
  let detector: EmptyResponseDetector;

  beforeEach(() => {
    detector = new EmptyResponseDetector({
      maxConsecutiveEmpty: 3,
      contextSnapshotSize: 10,
    });
  });

  afterEach(() => {
    detector.reset();
  });

  function createResponseEvent(content: string, responseLength?: number): MonitoringEvent {
    return {
      timestamp: new Date(),
      type: content === '' || content === 'NO_REPLY' ? 'empty_response' : 'normal',
      content,
      responseLength: responseLength ?? content.length,
    };
  }

  it('should not trigger with no events', () => {
    const result = detector.check([]);
    expect(result.triggered).toBe(false);
  });

  it('should not trigger with normal responses', () => {
    const events = [
      createResponseEvent('Hello, how can I help?'),
      createResponseEvent('The weather is nice today.'),
    ];
    const result = detector.check(events);
    expect(result.triggered).toBe(false);
  });

  it('should trigger with consecutive NO_REPLY responses', () => {
    const events = [
      createResponseEvent('NO_REPLY'),
      createResponseEvent('NO_REPLY'),
      createResponseEvent('NO_REPLY'),
    ];
    const result = detector.check(events);
    expect(result.triggered).toBe(true);
    expect(result.alertType).toBe('empty_response');
  });

  it('should trigger with consecutive empty responses', () => {
    const events = [
      createResponseEvent('', 0),
      createResponseEvent('', 0),
      createResponseEvent('', 0),
    ];
    const result = detector.check(events);
    expect(result.triggered).toBe(true);
    expect(result.alertType).toBe('empty_response');
  });

  it('should not trigger when non-empty responses reset count', () => {
    const events = [
      createResponseEvent('NO_REPLY'),
      createResponseEvent('NO_REPLY'),
      createResponseEvent('Here is your answer!'),
      createResponseEvent('NO_REPLY'),
      createResponseEvent('NO_REPLY'),
    ];
    const result = detector.check(events);
    // Only 2 consecutive NO_REPLY at the end (after the normal response), not 3
    // So it should NOT trigger
    expect(result.triggered).toBe(false);
  });

  it('should provide severity based on consecutive count', () => {
    const events = [
      createResponseEvent('NO_REPLY'),
      createResponseEvent('NO_REPLY'),
      createResponseEvent('NO_REPLY'),
      createResponseEvent('NO_REPLY'),
      createResponseEvent('NO_REPLY'),
      createResponseEvent('NO_REPLY'),
    ];
    const result = detector.check(events);
    expect(result.triggered).toBe(true);
    expect(result.severity).toBe('critical');
  });

  it('should include count in details', () => {
    const events = [
      createResponseEvent('NO_REPLY'),
      createResponseEvent('NO_REPLY'),
      createResponseEvent('NO_REPLY'),
    ];
    const result = detector.check(events);
    expect(result.details).toHaveProperty('consecutiveEmpty');
    expect(result.details).toHaveProperty('consecutiveNO_REPLY');
  });

  it('should reset correctly', () => {
    const events = [
      createResponseEvent('NO_REPLY'),
      createResponseEvent('NO_REPLY'),
      createResponseEvent('NO_REPLY'),
    ];
    detector.check(events);
    detector.reset();

    const newEvents = [createResponseEvent('NO_REPLY')];
    const result = detector.check(newEvents);
    expect(result.triggered).toBe(false);
  });
});
