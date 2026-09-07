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

function cacheDirectives(value) {
  return new Set((value ?? '')
    .split(',')
    .map((directive) => directive.trim().split('=', 1)[0].toLowerCase())
    .filter(Boolean));
}

export function evaluateResponse({
  scenario,
  expectedCacheable,
  headers,
  body,
  expectation = 'baseline',
  sample = 'response',
  requireCloudflareHit = expectation === 'cloudflare' && expectedCacheable,
}) {
  const cacheControl = headers.get('cache-control');
  const directives = cacheDirectives(cacheControl);
  const cfCacheStatus = headers.get('cf-cache-status');
  const setCookie = headers.get('set-cookie');
  const csp = headers.get('content-security-policy');
  const reasons = [];
  const label = `${scenario} ${sample}`;

  if (expectation === 'cloudflare' && !cfCacheStatus) {
    reasons.push(`${label} must include CF-Cache-Status in cloudflare mode`);
  }

  if (!expectedCacheable && cfCacheStatus?.toUpperCase() === 'HIT') {
    reasons.push(`${label} must never be HIT`);
  }

  if (expectedCacheable && setCookie) {
    reasons.push(`${label} cacheable HTML must not emit Set-Cookie`);
  }

  if (expectedCacheable && (hasNonce(csp ?? '') || hasNonce(body))) {
    reasons.push(`${label} cacheable HTML must not contain a nonce`);
  }

  if (expectedCacheable && expectation !== 'baseline') {
    if (!directives.has('public') || !directives.has('s-maxage')) {
      reasons.push(`${label} must use public and s-maxage Cache-Control in ${expectation} mode`);
    }
    if (['private', 'no-store', 'no-cache'].some((directive) => directives.has(directive))) {
      reasons.push(`${label} must not use private, no-store, or no-cache Cache-Control in ${expectation} mode`);
    }
  }

  if (!expectedCacheable) {
    if (directives.has('public') || directives.has('s-maxage')) {
      reasons.push(`${label} must not use public or s-maxage Cache-Control`);
    }
    if (expectation !== 'baseline' && (!directives.has('private') || !directives.has('no-store'))) {
      reasons.push(`${label} must use private, no-store Cache-Control in ${expectation} mode`);
    }
  }

  if (requireCloudflareHit && cfCacheStatus?.toUpperCase() !== 'HIT') {
    reasons.push(`${label} must be HIT in cloudflare mode`);
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

async function requestScenario(baseUrl, scenario, fetchImpl = fetch, now = () => performance.now()) {
  const url = new URL(scenario.path, baseUrl);
  const startedAt = now();
  const response = await fetchImpl(url, {
    headers: scenario.headers,
    redirect: 'follow',
  });
  const ttfbMs = now() - startedAt;
  const body = await response.text();

  return { response, body, ttfbMs };
}

function reportResponse(scenario, sample, expectation, ttfbMs = sample.ttfbMs, sampleName = 'response', requireCloudflareHit) {
  const { response, body } = sample;
  const evaluation = evaluateResponse({
    scenario: scenario.name,
    expectedCacheable: scenario.expectedCacheable,
    headers: response.headers,
    body,
    expectation,
    sample: sampleName,
    requireCloudflareHit,
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

export async function verifyStorefront({
  baseUrl,
  expectation = 'baseline',
  fetchImpl = fetch,
  now = () => performance.now(),
}) {
  if (!['baseline', 'origin', 'cloudflare'].includes(expectation)) {
    throw new Error('VERIFY_EXPECTATION must be baseline, origin, or cloudflare');
  }

  const results = [];

  for (const scenario of scenarios) {
    if (scenario.name === 'public-home' && expectation === 'cloudflare') {
      const cold = await requestScenario(baseUrl, scenario, fetchImpl, now);
      const warm = [];
      for (let request = 0; request < 10; request += 1) {
        warm.push(await requestScenario(baseUrl, scenario, fetchImpl, now));
      }
      const sampleReports = [
        reportResponse(scenario, cold, expectation, cold.ttfbMs, 'cold', false),
        ...warm.map((sample, index) => reportResponse(
          scenario,
          sample,
          expectation,
          sample.ttfbMs,
          `warm ${index + 1}`,
          true,
        )),
      ];
      const finalWarm = sampleReports.at(-1);
      const result = {
        ...finalWarm,
        ttfbMs: Math.round(median(warm.map((sample) => sample.ttfbMs)) * 100) / 100,
        coldTtfbMs: Math.round(cold.ttfbMs * 100) / 100,
        warmRequests: warm.length,
        pass: sampleReports.every((report) => report.pass),
        reasons: sampleReports.flatMap((report) => report.reasons),
      };
      results.push(result);
      continue;
    }

    const sample = await requestScenario(baseUrl, scenario, fetchImpl, now);
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
