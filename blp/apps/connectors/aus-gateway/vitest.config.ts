import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    threads: false,
    sequence: {
      concurrent: false,
    },
  },
});
