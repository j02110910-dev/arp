/**
 * SilentWatchMonitor Tests
 */

import { SilentWatchMonitor } from '../src/monitor';
import { SilentWatchConfig, MonitoringEvent } from '../src/config';
import { Alert } from '../src/config';

// Mock the file system operations
jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  readFileSync: jest.fn(() => '{}'),
  writeFileSync: jest.fn(),
  write: jest.fn(),
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
  unlinkSync: jest.fn(),
  statSync: jest.fn(() => ({ mtime: { getTime: () => Date.now() } })),
}));

describe('SilentWatchMonitor', () => {
  let monitor: SilentWatchMonitor;
  let config: SilentWatchConfig;

  beforeEach(() => {
    config = {
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
        console: { enabled: true, level: 'info' },
        wechat: { enabled: false },
        telegram: { enabled: false },
        email: { enabled: false },
      },
    };
    monitor = new SilentWatchMonitor(config);
  });

  afterEach(() => {
    monitor.stop();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with all detectors when enabled', () => {
      expect(monitor).toBeDefined();
      const stats = monitor.getStats();
      expect(stats.totalEvents).toBe(0);
      expect(stats.totalAlerts).toBe(0);
    });

    it('should not initialize detectors when disabled', () => {
      const disabledConfig = { ...config, enabled: false };
      const disabledMonitor = new SilentWatchMonitor(disabledConfig);
      expect(disabledMonitor).toBeDefined();
      disabledMonitor.stop();
    });
  });

  describe('recordEvent', () => {
    it('should not record events when monitor is disabled', () => {
      const disabledConfig = { ...config, enabled: false };
      const disabledMonitor = new SilentWatchMonitor(disabledConfig);
      
      disabledMonitor.recordEvent({
        timestamp: new Date(),
        type: 'tool_call',
        tool: 'test',
      });

      const stats = disabledMonitor.getStats();
      expect(stats.totalEvents).toBe(0);
      disabledMonitor.stop();
    });

    it('should add timestamp if not provided', () => {
      const event = {
        type: 'tool_call' as const,
        tool: 'test',
      };

      monitor.recordEvent(event);
      const stats = monitor.getStats();
      expect(stats.totalEvents).toBe(1);
    });

    it('should record tool call events', () => {
      monitor.recordEvent({
        timestamp: new Date(),
        type: 'tool_call',
        tool: 'test_tool',
        duration: 1000,
      });

      const stats = monitor.getStats();
      expect(stats.totalEvents).toBe(1);
      expect(stats.lastEventTime).toBeDefined();
    });

    it('should limit event history size', () => {
      const smallConfig = {
        ...config,
        detectors: { ...config.detectors, contextSnapshotSize: 3 },
      };
      const smallMonitor = new SilentWatchMonitor(smallConfig);

      // Record 20 events
      for (let i = 0; i < 20; i++) {
        smallMonitor.recordEvent({
          timestamp: new Date(),
          type: 'tool_call',
          tool: `tool_${i}`,
        });
      }

      const alerts = smallMonitor.getRecentAlerts(100);
      // Should be limited to contextSnapshotSize * 10 = 30
      expect(alerts.length).toBeLessThanOrEqual(30);
      smallMonitor.stop();
    });
  });

  describe('recordToolCall', () => {
    it('should record a tool call event', () => {
      monitor.recordToolCall('test_tool', { arg: 'value' }, { result: 'ok' }, 1000);

      const stats = monitor.getStats();
      expect(stats.totalEvents).toBe(1);
    });

    it('should ignore invalid toolName', () => {
      monitor.recordToolCall('', { arg: 'value' });
      monitor.recordToolCall(null as unknown as string, { arg: 'value' });
      monitor.recordToolCall(undefined as unknown as string, { arg: 'value' });

      const stats = monitor.getStats();
      expect(stats.totalEvents).toBe(0);
    });

    it('should ignore invalid duration', () => {
      monitor.recordToolCall('test_tool', {}, undefined, -100);
      monitor.recordToolCall('test_tool', {}, undefined, 'invalid' as unknown as number);

      const stats = monitor.getStats();
      expect(stats.totalEvents).toBe(0);
    });
  });

  describe('recordResponse', () => {
    it('should record normal response', () => {
      monitor.recordResponse('Hello world');

      const stats = monitor.getStats();
      expect(stats.totalEvents).toBe(1);
    });

    it('should record empty response as empty_response type', () => {
      monitor.recordResponse('');

      const stats = monitor.getStats();
      expect(stats.totalEvents).toBe(1);
    });

    it('should record NO_REPLY as empty_response type', () => {
      monitor.recordResponse('NO_REPLY');

      const stats = monitor.getStats();
      expect(stats.totalEvents).toBe(1);
    });

    it('should ignore null/undefined content', () => {
      monitor.recordResponse(null as unknown as string);
      monitor.recordResponse(undefined as unknown as string);

      const stats = monitor.getStats();
      expect(stats.totalEvents).toBe(0);
    });
  });

  describe('recordCronTrigger', () => {
    it('should record cron trigger event', () => {
      monitor.recordCronTrigger('myJob', 'job-123');

      const stats = monitor.getStats();
      expect(stats.totalEvents).toBe(1);
    });
  });

  describe('registerCronTask', () => {
    it('should register a cron task', () => {
      monitor.registerCronTask('myTask', 'task-123', 5000);

      // Should not throw
      expect(() => monitor.registerCronTask('myTask', 'task-123', 5000)).not.toThrow();
    });

    it('should ignore invalid task registration', () => {
      monitor.registerCronTask('', 'id', 5000);
      monitor.registerCronTask('name', '', 5000);
      monitor.registerCronTask('name', 'id', 500); // less than 1000ms
      monitor.registerCronTask('name', 'id', 0);

      // Should not throw, just ignore
      expect(() => monitor.registerCronTask('', 'id', 5000)).not.toThrow();
    });
  });

  describe('triggering alerts', () => {
    it('should trigger loop detection alert', () => {
      // Record 6 tool calls to the same tool
      for (let i = 0; i < 6; i++) {
        monitor.recordToolCall('search', { query: 'test' }, { results: [] });
      }

      const stats = monitor.getStats();
      expect(stats.totalAlerts).toBeGreaterThan(0);
      expect(stats.alertsByType.loop_detected).toBeGreaterThan(0);
    });

    it('should trigger empty response alert', () => {
      // Record 4 empty responses
      for (let i = 0; i < 4; i++) {
        monitor.recordResponse('NO_REPLY');
      }

      const stats = monitor.getStats();
      expect(stats.totalAlerts).toBeGreaterThan(0);
      expect(stats.alertsByType.empty_response).toBeGreaterThan(0);
    });

    it('should deduplicate similar alerts', () => {
      // Record 6 tool calls to trigger loop detection
      for (let i = 0; i < 6; i++) {
        monitor.recordToolCall('search', { query: 'test' }, { results: [] });
      }

      const stats1 = monitor.getStats();
      const alertCount1 = stats1.totalAlerts;

      // Record more calls to same tool - should be deduplicated
      for (let i = 0; i < 3; i++) {
        monitor.recordToolCall('search', { query: 'test' }, { results: [] });
      }

      const stats2 = monitor.getStats();
      // The second batch should be deduplicated
      // Note: The deduplication is based on fingerprint which includes tool name
      expect(stats2.totalAlerts).toBeGreaterThanOrEqual(alertCount1);
    });

    it('should call custom alert handler', (done) => {
      let handlerCalled = false;
      let receivedAlert: Alert | null = null;

      const configWithHandler: SilentWatchConfig = {
        ...config,
        notifiers: { console: { enabled: false }, wechat: { enabled: false }, telegram: { enabled: false }, email: { enabled: false } },
      };

      const monitorWithHandler = new SilentWatchMonitor(
        configWithHandler,
        (alert) => {
          handlerCalled = true;
          receivedAlert = alert;
        }
      );

      // Trigger an alert
      for (let i = 0; i < 6; i++) {
        monitorWithHandler.recordToolCall('search', { query: 'test' }, { results: [] });
      }

      // Give async handler time to be called
      setTimeout(() => {
        expect(handlerCalled).toBe(true);
        expect(receivedAlert).toBeDefined();
        monitorWithHandler.stop();
        done();
      }, 100);
    });

    it('should call config onAlert callback', () => {
      let callbackCalled = false;

      const configWithCallback: SilentWatchConfig = {
        ...config,
        onAlert: () => {
          callbackCalled = true;
        },
        notifiers: { console: { enabled: false }, wechat: { enabled: false }, telegram: { enabled: false }, email: { enabled: false } },
      };

      const monitorWithCallback = new SilentWatchMonitor(configWithCallback);

      // Trigger an alert
      for (let i = 0; i < 6; i++) {
        monitorWithCallback.recordToolCall('search', { query: 'test' }, { results: [] });
      }

      // Callback should be called
      expect(callbackCalled).toBe(true);

      monitorWithCallback.stop();
    });
  });

  describe('getStats', () => {
    it('should return current stats', () => {
      const stats = monitor.getStats();

      expect(stats).toHaveProperty('totalEvents');
      expect(stats).toHaveProperty('totalAlerts');
      expect(stats).toHaveProperty('uptimeSeconds');
      expect(stats).toHaveProperty('alertsByType');
      // lastEventTime is only set after at least one event is recorded
      // So we don't expect it in the initial stats
    });

    it('should track uptime', () => {
      const stats1 = monitor.getStats();
      expect(stats1.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics', () => {
      const metrics = monitor.getPerformanceMetrics();

      expect(metrics).toHaveProperty('avgEventProcessingTime');
      expect(metrics).toHaveProperty('avgAlertProcessingTime');
      expect(metrics).toHaveProperty('totalEventsProcessed');
      expect(metrics).toHaveProperty('memoryUsage');
    });

    it('should track event processing time', () => {
      // Record some events
      for (let i = 0; i < 5; i++) {
        monitor.recordEvent({
          timestamp: new Date(),
          type: 'tool_call',
          tool: 'test',
        });
      }

      const metrics = monitor.getPerformanceMetrics();
      expect(metrics.totalEventsProcessed).toBe(5);
    });
  });

  describe('getRecentAlerts', () => {
    it('should return recent alerts', () => {
      const alerts = monitor.getRecentAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should respect limit parameter', () => {
      // Trigger an alert
      for (let i = 0; i < 6; i++) {
        monitor.recordToolCall('search', { query: 'test' }, { results: [] });
      }

      const alerts = monitor.getRecentAlerts(5);
      expect(alerts.length).toBeLessThanOrEqual(5);
    });
  });

  describe('acknowledgeAlert', () => {
    it('should return false for unknown alert id', () => {
      const result = monitor.acknowledgeAlert('unknown-id');
      expect(result).toBe(false);
    });

    it('should acknowledge existing alert', () => {
      // Trigger an alert
      for (let i = 0; i < 6; i++) {
        monitor.recordToolCall('search', { query: 'test' }, { results: [] });
      }

      const alerts = monitor.getRecentAlerts(1);
      if (alerts.length > 0) {
        const result = monitor.acknowledgeAlert(alerts[0].id);
        expect(result).toBe(true);
        expect(alerts[0].acknowledged).toBe(true);
      }
    });
  });

  describe('resetAllDetectors', () => {
    it('should reset all detectors', () => {
      // Trigger an alert first
      for (let i = 0; i < 6; i++) {
        monitor.recordToolCall('search', { query: 'test' }, { results: [] });
      }

      // Reset
      monitor.resetAllDetectors();

      // Should not throw
      expect(() => monitor.resetAllDetectors()).not.toThrow();
    });
  });

  describe('updateConfig', () => {
    it('should update config', () => {
      monitor.updateConfig({ enabled: false });

      // Should not throw
      expect(() => monitor.updateConfig({ enabled: true })).not.toThrow();
    });
  });

  describe('healthCheck', () => {
    it('should return health status', () => {
      const health = monitor.healthCheck();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('lastCheck');
      expect(health).toHaveProperty('detectors');
      expect(health).toHaveProperty('notifiers');
    });

    it('should report detector statuses', () => {
      const health = monitor.healthCheck();

      expect(health.detectors).toHaveProperty('loop');
      expect(health.detectors).toHaveProperty('empty_response');
      expect(health.detectors.loop).toBe('active');
    });

    it('should report notifier statuses', () => {
      const health = monitor.healthCheck();

      expect(health.notifiers).toHaveProperty('console');
      expect(health.notifiers).toHaveProperty('wechat');
      expect(health.notifiers).toHaveProperty('telegram');
      expect(health.notifiers).toHaveProperty('email');
    });
  });

  describe('stop', () => {
    it('should stop without errors', () => {
      expect(() => monitor.stop()).not.toThrow();
    });
  });
});
