// Direct inline test without imports
interface Overrides {
  enabled?: boolean;
  tokenLimit?: number;
}

const getDefaultConfig = () => ({
  enabled: true,
  tokenLimit: 8000,
  compressionThreshold: 0.7,
  compressionStrategy: 'smart',
  maxAnchors: 10,
  maxKnowledgeEntries: 100,
  persistencePath: './cognitive-governor-data.json',
});

const loadConfig = (overrides?: Overrides) => {
  const config = getDefaultConfig();
  if (['false', '0', 'no', 'off'].includes(process.env.COGNITIVE_GOVERNOR_ENABLED ?? '')) {
    config.enabled = false;
  }
  if (process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT) {
    const parsed = parseInt(process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT, 10);
    config.tokenLimit = (isNaN(parsed) || parsed <= 0) ? 8000 : parsed;
  }
  if (overrides) {
    Object.assign(config, overrides);
  }
  return config;
};

describe('debug inline', () => {
  it('test inline loadConfig', () => {
    process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT = '0';
    const config = loadConfig();
    console.log('tokenLimit:', config.tokenLimit);
    expect(config.tokenLimit).toBe(8000);
  });
});
