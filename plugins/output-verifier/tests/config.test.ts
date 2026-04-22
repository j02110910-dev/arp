/**
 * Config Tests
 */

import { loadConfig, getDefaultConfig } from '../src/config';

describe('OutputVerifier Config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env before each test
    process.env = { ...originalEnv };
    // Clear any cached dotenv
    jest.resetModules();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getDefaultConfig', () => {
    it('should return a valid default config', () => {
      const config = getDefaultConfig();
      expect(config.enabled).toBe(true);
      expect(config.strictness).toBe('standard');
      expect(config.verifiers).toBeDefined();
      expect(config.verifiers.schema).toBeDefined();
      expect(config.verifiers.data).toBeDefined();
      expect(config.verifiers.api).toBeDefined();
      expect(config.verifiers.screenshot).toBeDefined();
      expect(config.verifiers.e2e).toBeDefined();
      expect(config.notifiers).toBeDefined();
      expect(config.reportPath).toBe('./verification-reports.json');
      expect(config.maxReports).toBe(100);
    });
  });

  describe('loadConfig - environment variable overrides', () => {
    it('should override enabled from env', () => {
      process.env.OUTPUT_VERIFIER_ENABLED = 'false';
      // Re-require to pick up env change
      const { loadConfig: lc } = require('../src/config');
      const config = lc();
      expect(config.enabled).toBe(false);
    });

    it('should override strictness from env', () => {
      process.env.OUTPUT_VERIFIER_STRICTNESS = 'strict';
      const { loadConfig: lc } = require('../src/config');
      const config = lc();
      expect(config.strictness).toBe('strict');
    });

    it('should override reportPath from env', () => {
      process.env.OUTPUT_VERIFIER_REPORT_PATH = '/custom/path/reports.json';
      const { loadConfig: lc } = require('../src/config');
      const config = lc();
      expect(config.reportPath).toBe('/custom/path/reports.json');
    });

    it('should configure API verifier from env', () => {
      process.env.OUTPUT_VERIFIER_API_URL = 'https://custom.api.com';
      process.env.OUTPUT_VERIFIER_API_KEY = 'test-key-123';
      const { loadConfig: lc } = require('../src/config');
      const config = lc();
      expect(config.verifiers.api.baseUrl).toBe('https://custom.api.com');
      expect(config.verifiers.api.apiKey).toBe('test-key-123');
      expect(config.verifiers.api.enabled).toBe(true);
    });

    it('should configure screenshot verifier from env', () => {
      process.env.OUTPUT_VERIFIER_VISION_API_KEY = 'vision-key-456';
      const { loadConfig: lc } = require('../src/config');
      const config = lc();
      expect(config.verifiers.screenshot.enabled).toBe(true);
      expect(config.verifiers.screenshot.apiKey).toBe('vision-key-456');
    });

    it('should configure WeChat notifier from env', () => {
      process.env.SERVER_CHAN_KEY = 'sc-key-789';
      const { loadConfig: lc } = require('../src/config');
      const config = lc();
      expect(config.notifiers.wechat).toBeDefined();
      expect(config.notifiers.wechat!.enabled).toBe(true);
      expect((config.notifiers.wechat as any).server酱Key).toBe('sc-key-789');
    });

    it('should configure Telegram notifier from env', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
      process.env.TELEGRAM_CHAT_ID = 'chat-id-123';
      const { loadConfig: lc } = require('../src/config');
      const config = lc();
      expect(config.notifiers.telegram).toBeDefined();
      expect(config.notifiers.telegram!.enabled).toBe(true);
      expect(config.notifiers.telegram!.botToken).toBe('bot-token');
      expect(config.notifiers.telegram!.chatId).toBe('chat-id-123');
    });
  });

  describe('loadConfig - overrides parameter', () => {
    it('should apply overrides parameter', () => {
      const { loadConfig: lc } = require('../src/config');
      const config = lc({ enabled: false, strictness: 'strict' });
      expect(config.enabled).toBe(false);
      expect(config.strictness).toBe('strict');
    });

    it('should merge overrides with defaults', () => {
      const { loadConfig: lc } = require('../src/config');
      const config = lc({ reportPath: '/tmp/custom.json' });
      // Overridden
      expect(config.reportPath).toBe('/tmp/custom.json');
      // Still default
      expect(config.enabled).toBe(true);
      expect(config.strictness).toBe('standard');
    });
  });
});
