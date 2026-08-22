import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      // Node's built-in experimental `localStorage` global (enabled by default since
      // Node 22+) shadows jsdom's Storage implementation and is left uninitialized
      // without `--localstorage-file`, breaking every localStorage-based test.
      execArgv: ['--no-experimental-webstorage'],
    },
  })
);
