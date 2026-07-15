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
      statements: 80,
      branches: 60,
      functions: 85,
      lines: 80,
    },
    './src/ConvertFileToJson.node.ts': {
      statements: 80,
      branches: 55,
      functions: 90,
      lines: 80,
    },
    './src/strategies/index.ts': {
      statements: 80,
      branches: 60,
      functions: 85,
      lines: 80,
    },
    './src/pipeline/v6.ts': {
      statements: 80,
      branches: 65,
      functions: 90,
      lines: 90,
    },
    './src/security/archive.ts': {
      statements: 80,
      branches: 60,
      functions: 85,
      lines: 90,
    },
    './src/ocr/index.ts': {
      statements: 90,
      branches: 60,
      functions: 90,
      lines: 90,
    },
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testTimeout: 30000,
};
