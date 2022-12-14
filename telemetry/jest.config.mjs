import config from '../jest.config.mjs';

const { testEnvironment, testEnvironmentOptions, transform, globals } = config;

export default {
  testEnvironment,
  testEnvironmentOptions,
  setupFilesAfterEnv: ['<rootDir>/../test/setup-env.js'],
  transform,
  globals
};
