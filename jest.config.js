module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!dist/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      statements: 35,
      branches: 25,
      functions: 35,
      lines: 35,
    },
    './src/FileToJsonNode.node.ts': {
      statements: 50,
      branches: 30,
      functions: 60,
      lines: 50,
    },
    './src/strategies/index.ts': {
      statements: 30,
      branches: 15,
      functions: 20,
      lines: 30,
    },
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testTimeout: 30000,
};