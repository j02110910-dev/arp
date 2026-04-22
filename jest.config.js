/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  verbose: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    'plugins/*/src/**/*.ts',
    '!plugins/*/dist/**',
    '!plugins/*/node_modules/**',
    '!src/**/*.d.ts',
  ],
};
