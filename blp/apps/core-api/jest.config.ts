import type { Config } from 'jest';

const config: Config = {
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.ts'],
  coverageReporters: ['text', 'lcov'],
};

export default config;
