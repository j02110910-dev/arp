"use strict";
/**
 * Permission Sentinel - Configuration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultConfig = getDefaultConfig;
exports.loadConfig = loadConfig;
function getDefaultConfig() {
    return {
        enabled: true,
        enableSanitization: true,
        enableCommandCheck: true,
        enableNetworkCheck: true,
        safeCommands: ['ls', 'cat', 'echo', 'pwd', 'date', 'whoami'],
        blockedCommands: [],
    };
}
function loadConfig(overrides) {
    const config = getDefaultConfig();
    if (process.env.PERMISSION_SENTINEL_ENABLED === 'false') {
        config.enabled = false;
    }
    if (overrides) {
        Object.assign(config, overrides);
    }
    return config;
}
//# sourceMappingURL=config.js.map