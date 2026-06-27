import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 30_000,
    setupFiles: ['./tests/setup.ts'],
    pool: 'forks',          // required for ESM + Node 20
    fileParallelism: false, // run test files sequentially (shared DB — avoid state races)
  },
})
