import { loadConfig } from '../src/config';

describe('debug', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('debug token limit', () => {
    delete process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT;
    console.log('ENV:', process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT);
    const config = loadConfig();
    console.log('Result:', config.tokenLimit);
    expect(config.tokenLimit).toBe(8000);
  });
});
