import { loadConfig } from '../src/config';

describe('debug', () => {
  it('test', () => {
    process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT = '0';
    console.log('Line 1');
    const config = loadConfig();
    console.log('Line 2, config.tokenLimit:', config.tokenLimit);
    console.log('Line 3');
  });
});
