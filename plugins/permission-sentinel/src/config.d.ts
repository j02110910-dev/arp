/**
 * Permission Sentinel - Configuration
 */
import { PermissionSentinelConfig } from './types';
export declare function getDefaultConfig(): PermissionSentinelConfig;
export declare function loadConfig(overrides?: Partial<PermissionSentinelConfig>): PermissionSentinelConfig;
