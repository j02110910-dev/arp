/**
 * Cognitive Governor - Config Tests
 * Tests for environment variable overrides, default values, and config loading
 */

import { loadConfig, getDefaultConfig } from '../src/config';

describe('config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clone env to avoid pollution between tests
    process.env = { ...originalEnv };
    // Clear all cognitive-governor env vars
    delete process.env.COGNITIVE_GOVERNOR_ENABLED;
    delete process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT;
    delete process.env.COGNITIVE_GOVERNOR_THRESHOLD;
    delete process.env.COGNITIVE_GOVERNOR_STRATEGY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ============================================
  // getDefaultConfig tests
  // ============================================
  describe('getDefaultConfig', () => {
    it('should return valid default configuration', () => {
      const config = getDefaultConfig();
      expect(config.enabled).toBe(true);
      expect(config.tokenLimit).toBe(8000);
      expect(config.compressionThreshold).toBe(0.7);
      expect(config.compressionStrategy).toBe('smart');
      expect(config.maxAnchors).toBe(10);
      expect(config.maxKnowledgeEntries).toBe(100);
      expect(config.persistencePath).toBe('./cognitive-governor-data.json');
    });

    it('should return a new object each time', () => {
      const config1 = getDefaultConfig();
      const config2 = getDefaultConfig();
      expect(config1).not.toBe(config2);
    });
  });

  // ============================================
  // Environment variable: COGNITIVE_GOVERNOR_ENABLED
  // ============================================
  describe('COGNITIVE_GOVERNOR_ENABLED environment variable', () => {
    it('should be enabled when env var not set', () => {
      const config = loadConfig();
      expect(config.enabled).toBe(true);
    });

    it('should disable when env is "false"', () => {
      process.env.COGNITIVE_GOVERNOR_ENABLED = 'false';
      const config = loadConfig();
      expect(config.enabled).toBe(false);
    });

    it('should disable when env is "0"', () => {
      process.env.COGNITIVE_GOVERNOR_ENABLED = '0';
      const config = loadConfig();
      expect(config.enabled).toBe(false);
    });

    it('should disable when env is "no"', () => {
      process.env.COGNITIVE_GOVERNOR_ENABLED = 'no';
      const config = loadConfig();
      expect(config.enabled).toBe(false);
    });

    it('should disable when env is "off"', () => {
      process.env.COGNITIVE_GOVERNOR_ENABLED = 'off';
      const config = loadConfig();
      expect(config.enabled).toBe(false);
    });

    it('should remain enabled when env is "true"', () => {
      process.env.COGNITIVE_GOVERNOR_ENABLED = 'true';
      const config = loadConfig();
      expect(config.enabled).toBe(true);
    });

    it('should remain enabled when env is "1"', () => {
      process.env.COGNITIVE_GOVERNOR_ENABLED = '1';
      const config = loadConfig();
      expect(config.enabled).toBe(true);
    });

    it('should remain enabled when env is "yes"', () => {
      process.env.COGNITIVE_GOVERNOR_ENABLED = 'yes';
      const config = loadConfig();
      expect(config.enabled).toBe(true);
    });

    it('should remain enabled when env is "on"', () => {
      process.env.COGNITIVE_GOVERNOR_ENABLED = 'on';
      const config = loadConfig();
      expect(config.enabled).toBe(true);
    });

    it('should remain enabled when env is arbitrary string', () => {
      process.env.COGNITIVE_GOVERNOR_ENABLED = 'anything';
      const config = loadConfig();
      expect(config.enabled).toBe(true);
    });
  });

  // ============================================
  // Environment variable: COGNITIVE_GOVERNOR_TOKEN_LIMIT
  // ============================================
  describe('COGNITIVE_GOVERNOR_TOKEN_LIMIT environment variable', () => {
    it('should use default 8000 when env var not set', () => {
      const config = loadConfig();
      expect(config.tokenLimit).toBe(8000);
    });

    it('should parse valid positive integer', () => {
      process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT = '10000';
      const config = loadConfig();
      expect(config.tokenLimit).toBe(10000);
    });

    it('should parse large token limit', () => {
      process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT = '100000';
      const config = loadConfig();
      expect(config.tokenLimit).toBe(100000);
    });

    it('should use default when value is NaN (invalid string)', () => {
      process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT = 'invalid';
      const config = loadConfig();
      expect(config.tokenLimit).toBe(8000);
    });

    it('should use default when value is 0', () => {
      process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT = '0';
      const config = loadConfig();
      expect(config.tokenLimit).toBe(8000);
    });

    it('should use default when value is negative', () => {
      process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT = '-100';
      const config = loadConfig();
      expect(config.tokenLimit).toBe(8000);
    });

    it('should use default when value is empty string', () => {
      process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT = '';
      const config = loadConfig();
      expect(config.tokenLimit).toBe(8000);
    });
  });

  // ============================================
  // Environment variable: COGNITIVE_GOVERNOR_THRESHOLD
  // ============================================
  describe('COGNITIVE_GOVERNOR_THRESHOLD environment variable', () => {
    it('should use default 0.7 when env var not set', () => {
      const config = loadConfig();
      expect(config.compressionThreshold).toBe(0.7);
    });

    it('should parse valid float threshold', () => {
      process.env.COGNITIVE_GOVERNOR_THRESHOLD = '0.8';
      const config = loadConfig();
      expect(config.compressionThreshold).toBe(0.8);
    });

    it('should parse threshold of 1.0', () => {
      process.env.COGNITIVE_GOVERNOR_THRESHOLD = '1.0';
      const config = loadConfig();
      expect(config.compressionThreshold).toBe(1.0);
    });

    it('should parse threshold of 0', () => {
      process.env.COGNITIVE_GOVERNOR_THRESHOLD = '0';
      const config = loadConfig();
      expect(config.compressionThreshold).toBe(0);
    });

    it('should use default when value is NaN (invalid string)', () => {
      process.env.COGNITIVE_GOVERNOR_THRESHOLD = 'invalid';
      const config = loadConfig();
      expect(config.compressionThreshold).toBe(0.7);
    });

    it('should use default when value is empty string', () => {
      process.env.COGNITIVE_GOVERNOR_THRESHOLD = '';
      const config = loadConfig();
      expect(config.compressionThreshold).toBe(0.7);
    });
  });

  // ============================================
  // Environment variable: COGNITIVE_GOVERNOR_STRATEGY
  // ============================================
  describe('COGNITIVE_GOVERNOR_STRATEGY environment variable', () => {
    it('should use default "smart" when env var not set', () => {
      const config = loadConfig();
      expect(config.compressionStrategy).toBe('smart');
    });

    it('should parse "truncate" strategy', () => {
      process.env.COGNITIVE_GOVERNOR_STRATEGY = 'truncate';
      const config = loadConfig();
      expect(config.compressionStrategy).toBe('truncate');
    });

    it('should parse "summarize" strategy', () => {
      process.env.COGNITIVE_GOVERNOR_STRATEGY = 'summarize';
      const config = loadConfig();
      expect(config.compressionStrategy).toBe('summarize');
    });

    it('should parse "smart" strategy', () => {
      process.env.COGNITIVE_GOVERNOR_STRATEGY = 'smart';
      const config = loadConfig();
      expect(config.compressionStrategy).toBe('smart');
    });
  });

  // ============================================
  // Override parameter tests
  // ============================================
  describe('loadConfig override parameter', () => {
    it('should use override to disable governor when env is "1"', () => {
      process.env.COGNITIVE_GOVERNOR_ENABLED = '1';
      const config = loadConfig({ enabled: false });
      expect(config.enabled).toBe(false);
    });

    it('should use override to enable governor when env is "false"', () => {
      process.env.COGNITIVE_GOVERNOR_ENABLED = 'false';
      const config = loadConfig({ enabled: true });
      expect(config.enabled).toBe(true);
    });

    it('should use override tokenLimit over env var', () => {
      process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT = '5000';
      const config = loadConfig({ tokenLimit: 20000 });
      expect(config.tokenLimit).toBe(20000);
    });

    it('should use override threshold over env var', () => {
      process.env.COGNITIVE_GOVERNOR_THRESHOLD = '0.5';
      const config = loadConfig({ compressionThreshold: 0.9 });
      expect(config.compressionThreshold).toBe(0.9);
    });

    it('should use override strategy over env var', () => {
      process.env.COGNITIVE_GOVERNOR_STRATEGY = 'smart';
      const config = loadConfig({ compressionStrategy: 'truncate' });
      expect(config.compressionStrategy).toBe('truncate');
    });

    it('should apply multiple overrides correctly', () => {
      const config = loadConfig({
        enabled: false,
        tokenLimit: 20000,
        compressionStrategy: 'truncate',
      });
      expect(config.enabled).toBe(false);
      expect(config.tokenLimit).toBe(20000);
      expect(config.compressionStrategy).toBe('truncate');
    });

    it('should preserve default values not overridden', () => {
      const config = loadConfig({ tokenLimit: 5000 });
      expect(config.maxAnchors).toBe(10);
      expect(config.maxKnowledgeEntries).toBe(100);
      expect(config.persistencePath).toBe('./cognitive-governor-data.json');
      expect(config.compressionThreshold).toBe(0.7);
      expect(config.compressionStrategy).toBe('smart');
    });

    it('should not modify original default config', () => {
      const default1 = getDefaultConfig();
      loadConfig({ tokenLimit: 5000 });
      const default2 = getDefaultConfig();
      expect(default1.tokenLimit).toBe(8000);
      expect(default2.tokenLimit).toBe(8000);
    });
  });

  // ============================================
  // Combined environment variable tests
  // ============================================
  describe('multiple environment variables combined', () => {
    it('should apply all env vars together', () => {
      process.env.COGNITIVE_GOVERNOR_ENABLED = 'false';
      process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT = '15000';
      process.env.COGNITIVE_GOVERNOR_THRESHOLD = '0.5';
      process.env.COGNITIVE_GOVERNOR_STRATEGY = 'truncate';
      const config = loadConfig();
      expect(config.enabled).toBe(false);
      expect(config.tokenLimit).toBe(15000);
      expect(config.compressionThreshold).toBe(0.5);
      expect(config.compressionStrategy).toBe('truncate');
    });

    it('should apply env vars and then override parameter', () => {
      process.env.COGNITIVE_GOVERNOR_ENABLED = 'false';
      process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT = '15000';
      const config = loadConfig({ enabled: true, tokenLimit: 20000 });
      expect(config.enabled).toBe(true);
      expect(config.tokenLimit).toBe(20000);
    });
  });

  // ============================================
  // Edge cases
  // ============================================
  describe('edge cases', () => {
    it('should handle call with no arguments', () => {
      const config = loadConfig();
      expect(config).toBeDefined();
      expect(typeof config.enabled).toBe('boolean');
      expect(typeof config.tokenLimit).toBe('number');
    });

    it('should handle call with undefined override', () => {
      const config = loadConfig(undefined);
      expect(config.enabled).toBe(true);
      expect(config.tokenLimit).toBe(8000);
    });

    it('should handle call with empty object override', () => {
      const config = loadConfig({});
      expect(config.enabled).toBe(true);
      expect(config.tokenLimit).toBe(8000);
    });

    it('should handle fractional token limit by truncating to integer', () => {
      process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT = '5000.7';
      const config = loadConfig();
      expect(config.tokenLimit).toBe(5000);
    });
  });
});
