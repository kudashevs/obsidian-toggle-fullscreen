import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // the obsidian package ships types only, so tests use a runtime stub
      obsidian: fileURLToPath(new URL('./tests/unit/__mocks__/obsidian.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
