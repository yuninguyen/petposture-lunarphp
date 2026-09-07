import { expect, test, type Page } from '@playwright/test';

async function bridgeUpgradedLocalRequests(page: Page) {
  await page.route('https://api.petposture.com/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = path === '/api/me'
      ? { user: null }
      : path === '/api/settings'
        ? {}
        : path === '/api/cart'
          ? { lines: [] }
          : { data: [] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('https://petposture.com:3101/**', async (route) => {
    const httpUrl = route.request().url().replace(/^https:\/\/petposture\.com/, 'http://127.0.0.1');
    const response = await fetch(httpUrl, {
      headers: { ...route.request().headers(), host: 'petposture.com:3101' },
    });
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
}

function captureBrowserFailures(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const requestFailures: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    requestFailures.push(`${request.url()} — ${request.failure()?.errorText ?? 'unknown failure'}`);
  });

  return { consoleErrors, pageErrors, requestFailures };
}

function jsonLdTypes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(jsonLdTypes);
  }
  if (!value || typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;
  const ownTypes = Array.isArray(record['@type'])
    ? record['@type'].filter((type): type is string => typeof type === 'string')
    : typeof record['@type'] === 'string'
      ? [record['@type']]
      : [];

  return [...ownTypes, ...Object.values(record).flatMap(jsonLdTypes)];
}

test('homepage hydrates without CSP violations or page errors', async ({ page }) => {
  await bridgeUpgradedLocalRequests(page);
  const failures = captureBrowserFailures(page);
  const response = await page.goto('http://petposture.com:3101/');

  expect(response?.url()).toBe('http://petposture.com:3101/');
  expect(response?.headers()['cache-control']).toContain('public');
  const html = await response?.text();
  expect(html).toBeDefined();
  expect(html?.replace(/\s+/g, ' ')).not.toMatch(/nonce\s*=\s*["']/i);

  await expect(page.locator('body')).toBeVisible();
  const jsonLd = page.locator('script[type="application/ld+json"]');
  const jsonLdValues = await jsonLd.evaluateAll((scripts) => scripts.map((script) => JSON.parse(script.textContent ?? '')));
  const types = jsonLdValues.flatMap(jsonLdTypes);
  expect(types).toContain('Organization');
  expect(types).toContain('WebSite');

  await expect(page.getByRole('heading', { name: 'Better Products for the Way Your Dog Is Built.' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.readyState)).toBe('complete');
  expect(failures.requestFailures).toEqual([]);
  expect(failures.consoleErrors.filter((text) => /content security policy|csp/i.test(text))).toEqual([]);
  expect(failures.pageErrors).toEqual([]);
});

test('private route retains no-store and nonce CSP', async ({ page }) => {
  await bridgeUpgradedLocalRequests(page);
  const failures = captureBrowserFailures(page);
  const response = await page.goto('http://petposture.com:3101/account');

  expect(response?.headers()['cache-control']).toContain('no-store');
  expect(response?.headers()['content-security-policy']).toContain('nonce-');
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.readyState)).toBe('complete');
  expect(failures.requestFailures).toEqual([]);
  expect(failures.consoleErrors.filter((text) => /content security policy|csp/i.test(text))).toEqual([]);
  expect(failures.pageErrors).toEqual([]);
});
