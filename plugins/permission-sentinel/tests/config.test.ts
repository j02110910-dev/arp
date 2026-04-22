/**
 * Permission Sentinel - Config Tests
 */

import { loadConfig, getDefaultConfig } from '../src/config';

describe('config', () => {
  // ─── getDefaultConfig ────────────────────────────────────

  describe('getDefaultConfig', () => {
    it('should return default configuration', () => {
      const config = getDefaultConfig();

      expect(config.enabled).toBe(true);
      expect(config.enableSanitization).toBe(true);
      expect(config.enableCommandCheck).toBe(true);
      expect(config.enableNetworkCheck).toBe(true);
      expect(config.safeCommands).toEqual(['ls', 'cat', 'echo', 'pwd', 'date', 'whoami']);
      expect(config.blockedCommands).toEqual([]);
    });
  });

  // ─── loadConfig ──────────────────────────────────────────

  describe('loadConfig', () => {
    it('should return default config when no overrides provided', () => {
      const config = loadConfig();

      expect(config.enabled).toBe(true);
      expect(config.enableSanitization).toBe(true);
    });

    it('should override specific values with provided overrides', () => {
      const config = loadConfig({ enabled: false });

      expect(config.enabled).toBe(false);
      expect(config.enableSanitization).toBe(true); // unchanged
    });

    it('should filter out undefined values from overrides', () => {
      // The implementation filters undefined values:
      // Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined))
      const overrides = {
        enabled: false,
        enableSanitization: undefined,
        safeCommands: undefined,
        blockedCommands: undefined,
        rules: undefined,
      };

      const config = loadConfig(overrides);

      // enabled should be overridden to false (explicit value)
      expect(config.enabled).toBe(false);
    });

    it('should allow explicit falsy values to override', () => {
      // Explicit false (not undefined) should override
      const config = loadConfig({ enabled: false });

      expect(config.enabled).toBe(false);
    });

    it('should allow empty object overrides', () => {
      const config = loadConfig({});

      expect(config.enabled).toBe(true);
      expect(config.enableSanitization).toBe(true);
    });

    it('should merge multiple overrides correctly', () => {
      const config = loadConfig({
        enableSanitization: false,
        safeCommands: ['custom', 'commands'],
      });

      expect(config.enableSanitization).toBe(false);
      expect(config.safeCommands).toEqual(['custom', 'commands']);
      expect(config.enabled).toBe(true); // default
    });

    it('should handle partial overrides with only defined values', () => {
      const config = loadConfig({
        enabled: true,
        enableCommandCheck: false,
      });

      expect(config.enabled).toBe(true);
      expect(config.enableCommandCheck).toBe(false);
    });

    it('should filter undefined but not null or other falsy values', () => {
      // null is not undefined, so it should be applied
      const config = loadConfig({
        enabled: null as any,
        safeCommands: [] as any,
      });

      // null should be applied (even though it's unusual)
      expect(config.enabled).toBe(null);
      expect(config.safeCommands).toEqual([]);
    });
  });
});
