/**
 * Permission Sentinel - Configuration
 */

import { PermissionSentinelConfig } from './types';

export function getDefaultConfig(): PermissionSentinelConfig {
  return {
    enabled: true,
    enableSanitization: true,
    enableCommandCheck: true,
    enableNetworkCheck: true,
    safeCommands: ['ls', 'cat', 'echo', 'pwd', 'date', 'whoami'],
    blockedCommands: [],
  };
}

export function loadConfig(overrides?: Partial<PermissionSentinelConfig>): PermissionSentinelConfig {
  const config = getDefaultConfig();

  if (process.env.PERMISSION_SENTINEL_ENABLED === 'false') {
    config.enabled = false;
  }

  if (overrides) {
    const filteredOverrides = Object.fromEntries(
      Object.entries(overrides).filter(([, value]) => value !== undefined)
    );
    Object.assign(config, filteredOverrides);
  }

  return config;
}
