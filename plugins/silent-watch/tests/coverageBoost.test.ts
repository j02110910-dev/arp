/**
 * Coverage Boost Tests - Targeted untested branches
 * Goal: Boost branch coverage from 79.77% to 80%+
 */

import { LoopDetector } from '../src/detectors/loopDetector';
import { EmptyResponseDetector } from '../src/detectors/emptyResponseDetector';
import { loadConfig } from '../src/config';
import { MonitoringEvent } from '../src/types';

// Save original env
const originalEnv = { ...process.env };

describe('Coverage Boost - LoopDetector Cleanup Branch (lines 111-112)', () => {
  let detector: LoopDetector;

  beforeEach(() => {
    detector = new LoopDetector({ maxConsecutiveCalls: 5, contextSnapshotSize: 10 });
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // Lines 111-112: Alert reset when different tool breaks the consecutive chain
  // The cleanup condition is: secondLastTool !== undefined && secondLastTool !== toolName && this.alertedTools.has(toolName)
  // The cleanup deletes: this.alertedTools.delete(toolName) and this.consecutiveSameResultCount.delete(toolName)
  // For this to work, we need toolName (the current tool in the second call) to already be in alertedTools
  test('should execute alert reset cleanup when different tool breaks chain', () => {
    // First, trigger alert for 'search' by calling it 5 times consecutively
    const triggerEvents: MonitoringEvent[] = [
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
    ];
    const triggerResult = detector.check(triggerEvents);
    expect(triggerResult.triggered).toBe(true);

    // Now call 'other_tool' twice, then 'search' again
    // This should break the 'search' chain and trigger cleanup
    const breakEvents: MonitoringEvent[] = [
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
      { timestamp: new Date(), type: 'tool_call', tool: 'search' },
      { timestamp: new Date(), type: 'tool_call', tool: 'other_tool' },
      { timestamp: new Date(), type: 'tool_call', tool: 'other_tool' },
      { timestamp: new Date(), type: 'tool_call', tool: 'search' }, // search is now back, should not re-alert
    ];
    const breakResult = detector.check(breakEvents);
    // search should not trigger because chain was broken
    expect(breakResult.triggered).toBe(false);
  });

  test('should handle alert reset when tool appears after different tool', () => {
    // Trigger initial alert
    const triggerEvents: MonitoringEvent[] = Array(5).fill(null).map((_, i) => ({
      timestamp: new Date(),
      type: 'tool_call' as const,
      tool: 'loop_tool',
    }));
    const triggerResult = detector.check(triggerEvents);
    expect(triggerResult.triggered).toBe(true);

    // Break chain and then restore
    const breakAndRestoreEvents: MonitoringEvent[] = [
      { timestamp: new Date(), type: 'tool_call', tool: 'loop_tool' },
      { timestamp: new Date(), type: 'tool_call', tool: 'loop_tool' },
      { timestamp: new Date(), type: 'tool_call', tool: 'different' },
      { timestamp: new Date(), type: 'tool_call', tool: 'loop_tool' },
    ];
    const result = detector.check(breakAndRestoreEvents);
    // Should not trigger because different tool broke the chain
    expect(result.triggered).toBe(false);
  });
});

describe('Coverage Boost - EmptyResponseDetector Critical Severity (lines 69-70)', () => {
  let detector: EmptyResponseDetector;

  beforeEach(() => {
    // Use maxConsecutiveEmpty=4 so maxEmpty*2=8
    detector = new EmptyResponseDetector({ maxConsecutiveEmpty: 4, contextSnapshotSize: 20 });
  });

  // Lines 69-70: critical severity when consecutiveNO_REPLY >= maxEmpty * 2
  // The issue is that consecutiveEmpty is only incremented when isEmptyResponse is true
  // For events with type='normal' and content='NO_REPLY', isEmptyResponse is false
  // So we need type='empty_response' with content='NO_REPLY' to increment BOTH counters
  test('should trigger critical severity when consecutiveNO_REPLY exactly equals maxEmpty * 2', () => {
    // Need 8 events where type='empty_response' and content='NO_REPLY'
    // This makes isEmptyResponse=true AND isNO_REPLY=true
    // So consecutiveEmpty=8 and consecutiveNO_REPLY=8
    // With maxEmpty=4, maxEmpty*2=8, so consecutiveNO_REPLY >= 8 triggers critical
    const events: MonitoringEvent[] = [];
    for (let i = 0; i < 8; i++) {
      events.push({
        timestamp: new Date(),
        type: 'empty_response',
        content: 'NO_REPLY'
      });
    }

    const result = detector.check(events);
    expect(result.triggered).toBe(true);
    expect(result.severity).toBe('critical');
  });

  test('should trigger critical severity when consecutiveNO_REPLY exceeds maxEmpty * 2', () => {
    // With maxEmpty=3, maxEmpty*2=6, so need > 6 NO_REPLY events
    const detector2 = new EmptyResponseDetector({ maxConsecutiveEmpty: 3, contextSnapshotSize: 20 });
    const events: MonitoringEvent[] = [];
    for (let i = 0; i < 7; i++) {
      events.push({
        timestamp: new Date(),
        type: 'empty_response',
        content: 'NO_REPLY'
      });
    }

    const result = detector2.check(events);
    expect(result.triggered).toBe(true);
    expect(result.severity).toBe('critical');
  });

  // Test that medium severity works when consecutiveEmpty >= maxEmpty but consecutiveNO_REPLY < maxEmpty * 2
  test('should assign medium severity when only consecutiveEmpty exceeds threshold', () => {
    // Use type='empty_response' with empty content to count empty but NOT NO_REPLY
    const events: MonitoringEvent[] = [];
    for (let i = 0; i < 5; i++) {
      events.push({
        timestamp: new Date(),
        type: 'empty_response',
        content: ''  // empty, not NO_REPLY
      });
    }

    const result = detector.check(events);
    expect(result.triggered).toBe(true);
    expect(result.severity).toBe('medium');
  });
});

describe('Coverage Boost - Config Notifier Auto-Disable (lines 219-220, 225-226, 232-233)', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clear all notifier-related env vars
    delete process.env.SERVER_CHAN_KEY;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.TO_EMAIL;
    delete process.env.SMTP_PORT;
    jest.resetModules();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // Lines 219-220: WeChat auto-disable when enabled but no server酱Key
  test('should disable wechat when config file enables it but server酱Key is missing', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const tmpFile = path.join(os.tmpdir(), 'test-wechat-config.json');

    // Config enables wechat but doesn't provide server酱Key
    fs.writeFileSync(tmpFile, JSON.stringify({
      notifiers: {
        wechat: { enabled: true }
        // server酱Key intentionally missing
      }
    }));

    try {
      const config = loadConfig(tmpFile);
      // Should be auto-disabled because server酱Key is required
      expect(config.notifiers.wechat?.enabled).toBe(false);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  // Lines 225-226: Telegram auto-disable when enabled but botToken or chatId missing
  test('should disable telegram when config file enables it but botToken is missing', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const tmpFile = path.join(os.tmpdir(), 'test-telegram-config.json');

    // Config enables telegram but only provides chatId, not botToken
    fs.writeFileSync(tmpFile, JSON.stringify({
      notifiers: {
        telegram: { enabled: true, chatId: 'test-chat' }
        // botToken intentionally missing
      }
    }));

    try {
      const config = loadConfig(tmpFile);
      expect(config.notifiers.telegram?.enabled).toBe(false);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test('should disable telegram when config file enables it but chatId is missing', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const tmpFile = path.join(os.tmpdir(), 'test-telegram-config2.json');

    // Config enables telegram but only provides botToken, not chatId
    fs.writeFileSync(tmpFile, JSON.stringify({
      notifiers: {
        telegram: { enabled: true, botToken: 'test-token' }
        // chatId intentionally missing
      }
    }));

    try {
      const config = loadConfig(tmpFile);
      expect(config.notifiers.telegram?.enabled).toBe(false);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  // Lines 232-233: Email auto-disable when enabled but required fields missing
  test('should disable email when config file enables it but smtpHost is missing', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const tmpFile = path.join(os.tmpdir(), 'test-email-config.json');

    // Config enables email but provides smtpUser and toEmail, not smtpHost
    fs.writeFileSync(tmpFile, JSON.stringify({
      notifiers: {
        email: {
          enabled: true,
          smtpUser: 'user',
          smtpPass: 'pass',
          toEmail: 'test@example.com'
          // smtpHost intentionally missing
        }
      }
    }));

    try {
      const config = loadConfig(tmpFile);
      expect(config.notifiers.email?.enabled).toBe(false);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test('should disable email when config file enables it but smtpUser is missing', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const tmpFile = path.join(os.tmpdir(), 'test-email-config2.json');

    // Config enables email but provides smtpHost and toEmail, not smtpUser
    fs.writeFileSync(tmpFile, JSON.stringify({
      notifiers: {
        email: {
          enabled: true,
          smtpHost: 'smtp.example.com',
          smtpPass: 'pass',
          toEmail: 'test@example.com'
          // smtpUser intentionally missing
        }
      }
    }));

    try {
      const config = loadConfig(tmpFile);
      expect(config.notifiers.email?.enabled).toBe(false);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test('should disable email when config file enables it but toEmail is missing', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const tmpFile = path.join(os.tmpdir(), 'test-email-config3.json');

    // Config enables email but provides smtpHost and smtpUser, not toEmail
    fs.writeFileSync(tmpFile, JSON.stringify({
      notifiers: {
        email: {
          enabled: true,
          smtpHost: 'smtp.example.com',
          smtpUser: 'user',
          smtpPass: 'pass'
          // toEmail intentionally missing
        }
      }
    }));

    try {
      const config = loadConfig(tmpFile);
      expect(config.notifiers.email?.enabled).toBe(false);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});
