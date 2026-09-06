import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

export const scenarios = [
  { name: 'public-home', path: '/', expectedCacheable: true },
  { name: 'private-account', path: '/account', expectedCacheable: false },
  { name: 'query-home', path: '/?utm_source=cache-test', expectedCacheable: false },
  { name: 'preview-shape', path: '/?expires=4102444800&signature=invalid-test-signature', expectedCacheable: false },
  { name: 'rsc-query', path: '/?_rsc=cache-test', expectedCacheable: false },
  { name: 'prefetch-purpose', path: '/', expectedCacheable: false, headers: { Purpose: 'prefetch' } },
  { name: 'prefetch-next-router', path: '/', expectedCacheable: false, headers: { 'Next-Router-Prefetch': '1' } },
  { name: 'session-cookie', path: '/', expectedCacheable: false, headers: { Cookie: 'petposture-session=test' } },
  { name: 'xsrf-cookie', path: '/', expectedCacheable: false, headers: { Cookie: 'XSRF-TOKEN=test' } },
];

function hasNonce(value) {
  return /(?:nonce[-=]["']?|\bnonce=)[^\s;>"']+/i.test(value);
}

export function evaluateResponse({ scenario, expectedCacheable, headers, body, expectation = 'baseline' }) {
  const cacheControl = headers.get('cache-control');
  const cfCacheStatus = headers.get('cf-cache-status');
  const setCookie = headers.get('set-cookie');
  const csp = headers.get('content-security-policy');
  const reasons = [];

  if (!expectedCacheable && cfCacheStatus?.toUpperCase() === 'HIT') {
    reasons.push(`${scenario} must never be HIT`);
  }

  if (expectedCacheable && setCookie) {
    reasons.push(`${scenario} cacheable HTML must not emit Set-Cookie`);
  }

  if (expectedCacheable && (hasNonce(csp ?? '') || hasNonce(body))) {
    reasons.push(`${scenario} cacheable HTML must not contain a nonce`);
  }

  if (expectedCacheable && expectation !== 'baseline' && !/(?:^|,)\s*public\b/i.test(cacheControl ?? '')) {
    reasons.push(`${scenario} must use public Cache-Control in ${expectation} mode`);
  }

  if (expectedCacheable && expectation === 'cloudflare' && cfCacheStatus?.toUpperCase() !== 'HIT') {
    reasons.push(`${scenario} warm response must be HIT in cloudflare mode`);
  }

  return { pass: reasons.length === 0, reasons };
}

export function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

async function requestScenario(baseUrl, scenario) {
  const url = new URL(scenario.path, baseUrl);
  const startedAt = performance.now();
  const response = await fetch(url, {
    headers: scenario.headers,
    redirect: 'follow',
  });
  const ttfbMs = performance.now() - startedAt;
  const body = await response.text();

  return { response, body, ttfbMs };
}

function reportResponse(scenario, sample, expectation, ttfbMs = sample.ttfbMs) {
  const { response, body } = sample;
  const evaluation = evaluateResponse({
    scenario: scenario.name,
    expectedCacheable: scenario.expectedCacheable,
    headers: response.headers,
    body,
    expectation,
  });

  return {
    scenario: scenario.name,
    status: response.status,
    ttfbMs: Math.round(ttfbMs * 100) / 100,
    cacheControl: response.headers.get('cache-control'),
    cfCacheStatus: response.headers.get('cf-cache-status'),
    age: response.headers.get('age'),
    setCookie: response.headers.has('set-cookie') ? '[REDACTED]' : null,
    contentType: response.headers.get('content-type'),
    csp: response.headers.get('content-security-policy'),
    pass: evaluation.pass,
    reasons: evaluation.reasons,
  };
}

export async function verifyStorefront({ baseUrl, expectation = 'baseline' }) {
  if (!['baseline', 'origin', 'cloudflare'].includes(expectation)) {
    throw new Error('VERIFY_EXPECTATION must be baseline, origin, or cloudflare');
  }

  const results = [];

  for (const scenario of scenarios) {
    if (scenario.name === 'public-home' && expectation === 'cloudflare') {
      const cold = await requestScenario(baseUrl, scenario);
      const warm = [];
      for (let request = 0; request < 10; request += 1) {
        warm.push(await requestScenario(baseUrl, scenario));
      }
      const result = reportResponse(scenario, warm.at(-1), expectation, median(warm.map((sample) => sample.ttfbMs)));
      result.coldTtfbMs = Math.round(cold.ttfbMs * 100) / 100;
      result.warmRequests = warm.length;
      results.push(result);
      continue;
    }

    const sample = await requestScenario(baseUrl, scenario);
    results.push(reportResponse(scenario, sample, expectation));
  }

  return {
    expectation,
    generatedAt: new Date().toISOString(),
    pass: results.every((result) => result.pass),
    results,
  };
}

async function main() {
  const baseUrl = process.env.STOREFRONT_BASE_URL;
  if (!baseUrl) {
    throw new Error('STOREFRONT_BASE_URL is required');
  }

  const report = await verifyStorefront({
    baseUrl,
    expectation: process.env.VERIFY_EXPECTATION ?? 'baseline',
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.pass) {
    process.exitCode = 1;
  }
}

const invokedAsMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsMain) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
