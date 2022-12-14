export default {
  testEnvironment: 'miniflare',
  testEnvironmentOptions: {
    modules: true
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup-env.js'],
  transform: {},
  globals: {
    LOCAL_BASEURL: 'http://localhost:8787',
    POSTHOG_URL: 'https://app.posthog.com',
  }
};
