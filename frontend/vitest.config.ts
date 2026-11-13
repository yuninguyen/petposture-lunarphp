import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Mirrors `paths` in tsconfig.json so tests can import modules that use `@/`.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
});
