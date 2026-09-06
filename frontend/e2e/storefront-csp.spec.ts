import { expect, test, type Page } from '@playwright/test';

function captureBrowserFailures(page: Page) {
  const cspErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error' && /content security policy|csp/i.test(message.text())) {
      cspErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  return { cspErrors, pageErrors };
}

test('homepage hydrates without CSP violations or page errors', async ({ page }) => {
  const failures = captureBrowserFailures(page);
  const response = await page.goto('http://petposture.com:3101/');

  expect(response?.url()).toBe('http://petposture.com:3101/');
  expect(response?.headers()['cache-control']).toContain('public');
  await expect(page.locator('body')).toBeVisible();

  const jsonLd = page.locator('script[type="application/ld+json"]');
  const jsonLdHtml = await jsonLd.evaluateAll((scripts) => scripts.map((script) => script.textContent ?? '').join('\n'));
  expect(jsonLdHtml).toContain('Organization');
  expect(jsonLdHtml).toContain('WebSite');
  expect(await jsonLd.evaluateAll((scripts) => scripts.every((script) => !script.hasAttribute('nonce')))).toBe(true);

  await expect(page.getByRole('link', { name: 'View All Articles' })).toBeVisible();

  expect(failures.cspErrors).toEqual([]);
  expect(failures.pageErrors).toEqual([]);
});

test('private route retains no-store and nonce CSP', async ({ page }) => {
  const failures = captureBrowserFailures(page);
  const response = await page.goto('http://petposture.com:3101/account');

  expect(response?.headers()['cache-control']).toContain('no-store');
  expect(response?.headers()['content-security-policy']).toContain('nonce-');
  expect(failures.cspErrors).toEqual([]);
  expect(failures.pageErrors).toEqual([]);
});
