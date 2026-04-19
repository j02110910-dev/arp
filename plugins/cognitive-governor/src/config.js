"use strict";
/**
 * Cognitive Governor - Configuration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultConfig = getDefaultConfig;
exports.loadConfig = loadConfig;
function getDefaultConfig() {
    return {
        enabled: true,
        tokenLimit: 8000,
        compressionThreshold: 0.7,
        compressionStrategy: 'smart',
        maxAnchors: 10,
        maxKnowledgeEntries: 100,
        persistencePath: './cognitive-governor-data.json',
    };
}
function loadConfig(overrides) {
    const config = getDefaultConfig();
    if (process.env.COGNITIVE_GOVERNOR_ENABLED === 'false') {
        config.enabled = false;
    }
    if (process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT) {
        config.tokenLimit = parseInt(process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT, 10);
    }
    if (process.env.COGNITIVE_GOVERNOR_THRESHOLD) {
        config.compressionThreshold = parseFloat(process.env.COGNITIVE_GOVERNOR_THRESHOLD);
    }
    if (process.env.COGNITIVE_GOVERNOR_STRATEGY) {
        config.compressionStrategy = process.env.COGNITIVE_GOVERNOR_STRATEGY;
    }
    if (overrides) {
        Object.assign(config, overrides);
    }
    return config;
}
//# sourceMappingURL=config.js.map