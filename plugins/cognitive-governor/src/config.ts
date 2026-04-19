/**
 * Cognitive Governor - Configuration
 */

import { CognitiveGovernorConfig } from './types';

export function getDefaultConfig(): CognitiveGovernorConfig {
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

export function loadConfig(overrides?: Partial<CognitiveGovernorConfig>): CognitiveGovernorConfig {
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
    config.compressionStrategy = process.env.COGNITIVE_GOVERNOR_STRATEGY as CognitiveGovernorConfig['compressionStrategy'];
  }

  if (overrides) {
    Object.assign(config, overrides);
  }

  return config;
}
