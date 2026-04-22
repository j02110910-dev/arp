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

  if (['false', '0', 'no', 'off'].includes(process.env.COGNITIVE_GOVERNOR_ENABLED ?? '')) {
    config.enabled = false;
  }
  if (process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT) {
    const parsed = parseInt(process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT, 10);
    config.tokenLimit = (isNaN(parsed) || parsed <= 0) ? 8000 : parsed;
  }
  if (process.env.COGNITIVE_GOVERNOR_THRESHOLD) {
    const thresholdParsed = parseFloat(process.env.COGNITIVE_GOVERNOR_THRESHOLD);
    config.compressionThreshold = isNaN(thresholdParsed) ? 0.7 : thresholdParsed;
  }
  if (process.env.COGNITIVE_GOVERNOR_STRATEGY) {
    config.compressionStrategy = process.env.COGNITIVE_GOVERNOR_STRATEGY as CognitiveGovernorConfig['compressionStrategy'];
  }

  if (overrides) {
    Object.assign(config, overrides);
  }

  return config;
}
