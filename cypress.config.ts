import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    viewportWidth: parseInt(process.env.CYPRESS_VIEWPORT_WIDTH || '1280'),
    viewportHeight: parseInt(process.env.CYPRESS_VIEWPORT_HEIGHT || '720'),
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: parseInt(process.env.CYPRESS_API_TIMEOUT || '10000'),
    requestTimeout: parseInt(process.env.CYPRESS_API_TIMEOUT || '10000'),
    responseTimeout: parseInt(process.env.CYPRESS_API_TIMEOUT || '10000'),
    setupNodeEvents(on, config) {
      // implement node event listeners here
      config.env = {
        ...config.env,
        backendUrl: process.env.CYPRESS_BACKEND_URL || 'http://localhost:3001',
        apiTimeout: parseInt(process.env.CYPRESS_API_TIMEOUT || '10000'),
      };
      return config;
    },
    env: {
      backendUrl: 'http://localhost:3001',
      apiTimeout: 10000,
    },
  },
  component: {
    devServer: {
      framework: 'react',
      bundler: 'webpack',
    },
  },
});
