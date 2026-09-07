import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const packageJson = JSON.parse(
  await readFile(new URL('./package.json', import.meta.url), 'utf8'),
);
const playwrightConfig = await readFile(
  new URL('./playwright.config.ts', import.meta.url),
  'utf8',
);

test('CSP E2E command builds with the production API URL before Playwright starts the artifact', () => {
  assert.equal(
    packageJson.scripts['test:e2e:csp'],
    'cross-env NEXT_PUBLIC_API_URL=https://api.petposture.com npm run build && playwright test e2e/storefront-csp.spec.ts',
  );
  assert.match(playwrightConfig, /command:\s*['"]npm run start -- -p 3101['"]/);
  assert.equal(packageJson.devDependencies['cross-env'], '^7.0.3');
});
