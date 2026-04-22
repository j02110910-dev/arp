/**
 * Config Tests
 */

import { loadConfig, getDefaultConfigPath, DEFAULT_CONFIG } from '../src/config';

// Save original env
const originalEnv = { ...process.env };

describe('Config', () => {
  beforeEach(() => {
    // Reset env before each test
    process.env = { ...originalEnv };
    // Clear any cached modules
    jest.resetModules();
  });

  afterAll(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should return default config when no env vars set', () => {
      const config = loadConfig();
      expect(config.enabled).toBe(true);
      expect(config.detectLoops).toBe(true);
      expect(config.detectEmptyResponses).toBe(true);
      expect(config.detectTimeouts).toBe(true);
      expect(config.detectCronMisses).toBe(true);
      expect(config.detectAnomalies).toBe(true);
    });

    it('should disable when SILENT_WATCH_ENABLED is false', () => {
      process.env.SILENT_WATCH_ENABLED = 'false';
      const config = loadConfig();
      expect(config.enabled).toBe(false);
    });

    it('should disable when SILENT_WATCH_ENABLED is 0', () => {
      process.env.SILENT_WATCH_ENABLED = '0';
      const config = loadConfig();
      expect(config.enabled).toBe(false);
    });

    it('should enable when SILENT_WATCH_ENABLED is true', () => {
      process.env.SILENT_WATCH_ENABLED = 'true';
      const config = loadConfig();
      expect(config.enabled).toBe(true);
    });

    it('should enable when SILENT_WATCH_ENABLED is 1', () => {
      process.env.SILENT_WATCH_ENABLED = '1';
      const config = loadConfig();
      expect(config.enabled).toBe(true);
    });

    it('should parse SILENT_WATCH_MAX_CONSECUTIVE_CALLS', () => {
      process.env.SILENT_WATCH_MAX_CONSECUTIVE_CALLS = '15';
      const config = loadConfig();
      expect(config.detectors.maxConsecutiveCalls).toBe(15);
    });

    it('should parse SILENT_WATCH_MAX_CONSECUTIVE_EMPTY', () => {
      process.env.SILENT_WATCH_MAX_CONSECUTIVE_EMPTY = '5';
      const config = loadConfig();
      expect(config.detectors.maxConsecutiveEmpty).toBe(5);
    });

    it('should parse SILENT_WATCH_STEP_TIMEOUT_MS', () => {
      process.env.SILENT_WATCH_STEP_TIMEOUT_MS = '120000';
      const config = loadConfig();
      expect(config.detectors.stepTimeoutMs).toBe(120000);
    });

    it('should parse SILENT_WATCH_CONTEXT_SIZE', () => {
      process.env.SILENT_WATCH_CONTEXT_SIZE = '20';
      const config = loadConfig();
      expect(config.detectors.contextSnapshotSize).toBe(20);
    });

    it('should enable wechat when SERVER_CHAN_KEY is set', () => {
      process.env.SERVER_CHAN_KEY = 'test-key';
      const config = loadConfig();
      expect(config.notifiers.wechat?.enabled).toBe(true);
      expect(config.notifiers.wechat?.server酱Key).toBe('test-key');
    });

    it('should enable telegram when TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = 'test-chat';
      const config = loadConfig();
      expect(config.notifiers.telegram?.enabled).toBe(true);
      expect(config.notifiers.telegram?.botToken).toBe('test-token');
      expect(config.notifiers.telegram?.chatId).toBe('test-chat');
    });

    it('should enable email when SMTP_HOST is set', () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user';
      process.env.SMTP_PASS = 'pass';
      process.env.TO_EMAIL = 'to@example.com';
      const config = loadConfig();
      expect(config.notifiers.email?.enabled).toBe(true);
      expect(config.notifiers.email?.smtpHost).toBe('smtp.example.com');
    });

    it('should parse SMTP_PORT', () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user';
      process.env.SMTP_PASS = 'pass';
      process.env.TO_EMAIL = 'to@example.com';
      process.env.SMTP_PORT = '465';
      const config = loadConfig();
      expect(config.notifiers.email?.smtpPort).toBe(465);
    });

    it('should use default SMTP port when not specified', () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user';
      process.env.SMTP_PASS = 'pass';
      process.env.TO_EMAIL = 'to@example.com';
      const config = loadConfig();
      expect(config.notifiers.email?.smtpPort).toBe(587);
    });

    it('should set apiKey from SILENT_WATCH_API_KEY', () => {
      process.env.SILENT_WATCH_API_KEY = 'secret-key';
      const config = loadConfig();
      expect(config.apiKey).toBe('secret-key');
    });

    it('should set server.requireAuth from SILENT_WATCH_REQUIRE_AUTH', () => {
      process.env.SILENT_WATCH_REQUIRE_AUTH = 'true';
      const config = loadConfig();
      expect(config.server?.requireAuth).toBe(true);
    });

    it('should handle invalid config file gracefully', () => {
      // This tests that a non-existent config file doesn't throw
      const config = loadConfig('/non/existent/path.json');
      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
    });

    it('should load config from valid JSON file', () => {
      // Create a temp config file
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const tmpFile = path.join(os.tmpdir(), 'test-silent-watch-config.json');
      
      fs.writeFileSync(tmpFile, JSON.stringify({
        enabled: false,
        detectLoops: false,
      }));

      try {
        const config = loadConfig(tmpFile);
        expect(config.enabled).toBe(false);
        expect(config.detectLoops).toBe(false);
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    it('should handle malformed JSON config file gracefully', () => {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const tmpFile = path.join(os.tmpdir(), 'bad-silent-watch-config.json');
      
      fs.writeFileSync(tmpFile, '{ invalid json }');

      try {
        // Should not throw, should use defaults
        const config = loadConfig(tmpFile);
        expect(config).toBeDefined();
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });
  });

  describe('validateConfig', () => {
    it('should use default for maxConsecutiveCalls < 1', () => {
      process.env.SILENT_WATCH_MAX_CONSECUTIVE_CALLS = '0';
      const config = loadConfig();
      expect(config.detectors.maxConsecutiveCalls).toBe(DEFAULT_CONFIG.detectors.maxConsecutiveCalls);
    });

    it('should warn for maxConsecutiveCalls > 100', () => {
      process.env.SILENT_WATCH_MAX_CONSECUTIVE_CALLS = '150';
      // Should not throw, just warn
      const config = loadConfig();
      expect(config.detectors.maxConsecutiveCalls).toBe(150);
    });

    it('should use default for maxConsecutiveEmpty < 1', () => {
      process.env.SILENT_WATCH_MAX_CONSECUTIVE_EMPTY = '0';
      const config = loadConfig();
      expect(config.detectors.maxConsecutiveEmpty).toBe(DEFAULT_CONFIG.detectors.maxConsecutiveEmpty);
    });

    it('should use default for stepTimeoutMs < 1000', () => {
      process.env.SILENT_WATCH_STEP_TIMEOUT_MS = '500';
      const config = loadConfig();
      expect(config.detectors.stepTimeoutMs).toBe(DEFAULT_CONFIG.detectors.stepTimeoutMs);
    });

    it('should warn for stepTimeoutMs > 1 hour', () => {
      process.env.SILENT_WATCH_STEP_TIMEOUT_MS = '4000000';
      // Should not throw, just warn
      const config = loadConfig();
      expect(config.detectors.stepTimeoutMs).toBe(4000000);
    });

    it('should use default for contextSnapshotSize < 1', () => {
      process.env.SILENT_WATCH_CONTEXT_SIZE = '0';
      const config = loadConfig();
      expect(config.detectors.contextSnapshotSize).toBe(DEFAULT_CONFIG.detectors.contextSnapshotSize);
    });

    it('should not enable wechat when SERVER_CHAN_KEY is empty', () => {
      // When SERVER_CHAN_KEY is empty, wechat should not be enabled
      process.env.SERVER_CHAN_KEY = '';
      const config = loadConfig();
      expect(config.notifiers.wechat?.enabled).toBe(false);
    });

    it('should enable wechat when SERVER_CHAN_KEY is set', () => {
      // When SERVER_CHAN_KEY is truthy, wechat should be enabled
      process.env.SERVER_CHAN_KEY = 'valid-key';
      const config = loadConfig();
      expect(config.notifiers.wechat?.enabled).toBe(true);
    });

    it('should disable telegram if enabled but missing botToken', () => {
      // When TELEGRAM_BOT_TOKEN is set but empty, telegram should be disabled
      process.env.TELEGRAM_BOT_TOKEN = '';
      process.env.TELEGRAM_CHAT_ID = 'chat-id';
      const config = loadConfig();
      // telegram is only enabled if BOTH token and chatId are truthy
      // Empty string is falsy, so telegram should not be enabled
      expect(config.notifiers.telegram?.enabled).toBe(false);
    });

    it('should disable telegram if enabled but missing chatId', () => {
      // When TELEGRAM_CHAT_ID is empty, telegram should be disabled
      process.env.TELEGRAM_BOT_TOKEN = 'valid-token';
      process.env.TELEGRAM_CHAT_ID = '';
      const config = loadConfig();
      expect(config.notifiers.telegram?.enabled).toBe(false);
    });

    it('should disable email if missing required fields', () => {
      // Ensure clean state - explicitly delete and then set empty
      delete process.env.SMTP_HOST;
      process.env.SMTP_HOST = '';
      process.env.SMTP_USER = 'user';
      process.env.SMTP_PASS = 'pass';
      process.env.TO_EMAIL = 'to@example.com';
      const config = loadConfig();
      expect(config.notifiers.email?.enabled).toBe(false);
    });

    it('should use default smtpPort for invalid values', () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user';
      process.env.SMTP_PASS = 'pass';
      process.env.TO_EMAIL = 'to@example.com';
      process.env.SMTP_PORT = '0';
      const config = loadConfig();
      expect(config.notifiers.email?.smtpPort).toBe(587);
    });

    it('should use default smtpPort when > 65535', () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user';
      process.env.SMTP_PASS = 'pass';
      process.env.TO_EMAIL = 'to@example.com';
      process.env.SMTP_PORT = '70000';
      const config = loadConfig();
      expect(config.notifiers.email?.smtpPort).toBe(587);
    });
  });

  describe('getDefaultConfigPath', () => {
    it('should return a path in cwd', () => {
      const configPath = getDefaultConfigPath();
      expect(configPath).toContain('silent-watch.config.json');
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have all expected properties', () => {
      expect(DEFAULT_CONFIG.enabled).toBe(true);
      expect(DEFAULT_CONFIG.detectLoops).toBe(true);
      expect(DEFAULT_CONFIG.detectEmptyResponses).toBe(true);
      expect(DEFAULT_CONFIG.detectTimeouts).toBe(true);
      expect(DEFAULT_CONFIG.detectCronMisses).toBe(true);
      expect(DEFAULT_CONFIG.detectAnomalies).toBe(true);
      expect(DEFAULT_CONFIG.detectors.maxConsecutiveCalls).toBe(10);
      expect(DEFAULT_CONFIG.detectors.maxConsecutiveEmpty).toBe(3);
      expect(DEFAULT_CONFIG.detectors.stepTimeoutMs).toBe(60000);
      expect(DEFAULT_CONFIG.detectors.contextSnapshotSize).toBe(10);
      expect(DEFAULT_CONFIG.notifiers.console?.enabled).toBe(true);
      expect(DEFAULT_CONFIG.notifiers.wechat?.enabled).toBe(false);
      expect(DEFAULT_CONFIG.notifiers.telegram?.enabled).toBe(false);
      expect(DEFAULT_CONFIG.notifiers.email?.enabled).toBe(false);
      expect(DEFAULT_CONFIG.alertHistoryPath).toBe('./alert-history.json');
    });
  });
});
