describe('debug env', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('test 1 - set env', () => {
    process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT = '0';
    console.log('In test 1, ENV:', process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT);
  });

  it('test 2 - check env', () => {
    console.log('In test 2, ENV:', process.env.COGNITIVE_GOVERNOR_TOKEN_LIMIT);
  });
});
