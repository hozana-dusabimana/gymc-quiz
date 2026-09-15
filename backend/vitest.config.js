import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.js'],
    globalSetup: ['tests/globalSetup.js'],
    hookTimeout: 60_000,
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
