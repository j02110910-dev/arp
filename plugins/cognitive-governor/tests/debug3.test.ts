import { loadConfig } from '../src/config';

describe('debug import', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('test loadConfig with 0', () => {
    delete process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT;
    const config = loadConfig();
    console.log('tokenLimit:', config.tokenLimit);
    expect(config.tokenLimit).toBe(8000);
  });
});
