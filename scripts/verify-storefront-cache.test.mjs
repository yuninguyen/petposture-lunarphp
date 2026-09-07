import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateResponse, median, verifyStorefront } from './verify-storefront-cache.mjs';

function response(headers = {}, body = '<html></html>', status = 200) {
  return new Response(body, { status, headers });
}

test('rejects a private response reported as a Cloudflare HIT', () => {
  const result = evaluateResponse({
    scenario: 'private-account',
    expectedCacheable: false,
    headers: new Headers({
      'cf-cache-status': 'HIT',
      'cache-control': 'private, no-store',
    }),
    body: '<html></html>',
  });
  assert.equal(result.pass, false);
  assert.match(result.reasons.join('\n'), /must never be HIT/);
});

test('rejects cacheable HTML that emits Set-Cookie or a nonce', () => {
  const result = evaluateResponse({
    scenario: 'public-home',
    expectedCacheable: true,
    headers: new Headers({
      'cache-control': 'public, s-maxage=300',
      'set-cookie': 'petposture-session=secret',
      'content-security-policy': "script-src 'nonce-abc'",
    }),
    body: '<script nonce="abc"></script>',
  });
  assert.equal(result.pass, false);
  assert.match(result.reasons.join('\n'), /Set-Cookie/);
  assert.match(result.reasons.join('\n'), /nonce/);
});

test('rejects contradictory public cache directives in origin and cloudflare modes', () => {
  for (const expectation of ['origin', 'cloudflare']) {
    const result = evaluateResponse({
      scenario: 'public-home',
      expectedCacheable: true,
      expectation,
      sample: expectation === 'cloudflare' ? 'warm 1' : 'response',
      headers: new Headers({
        'cf-cache-status': expectation === 'cloudflare' ? 'HIT' : 'BYPASS',
        'cache-control': 'public, s-maxage=300, private, no-store, no-cache',
      }),
      body: '<html></html>',
    });

    assert.equal(result.pass, false);
    assert.match(result.reasons.join('\n'), /must not use private, no-store, or no-cache/);
  }
});

test('rejects public cache policy on private scenarios even in baseline mode', () => {
  const result = evaluateResponse({
    scenario: 'private-account',
    expectedCacheable: false,
    expectation: 'baseline',
    headers: new Headers({
      'cf-cache-status': 'BYPASS',
      'cache-control': 'public, s-maxage=300',
    }),
    body: '<html></html>',
  });

  assert.equal(result.pass, false);
  assert.match(result.reasons.join('\n'), /must not use public or s-maxage/);
});

test('requires private no-store policy for bypass scenarios when origin policy is expected', () => {
  for (const expectation of ['origin', 'cloudflare']) {
    const result = evaluateResponse({
      scenario: 'private-account',
      expectedCacheable: false,
      expectation,
      headers: new Headers({
        'cf-cache-status': 'BYPASS',
        'cache-control': 'private',
      }),
      body: '<html></html>',
    });

    assert.equal(result.pass, false);
    assert.match(result.reasons.join('\n'), /must use private, no-store/);
  }
});

test('cloudflare verification validates every cold and warm public response', async () => {
  let publicRequest = 0;
  const fetchImpl = async (url, options) => {
    const parsed = new URL(url);
    const isPublicHome = parsed.pathname === '/' && parsed.search === '' && publicRequest < 11;
    if (!isPublicHome) {
      return response({
        'cf-cache-status': 'BYPASS',
        'cache-control': 'private, no-store',
      });
    }

    publicRequest += 1;
    if (publicRequest === 1) {
      return response({
        'cache-control': 'public, s-maxage=300',
        'set-cookie': 'petposture-session=cold-secret',
      });
    }
    if (publicRequest === 5) {
      return response({
        'cf-cache-status': 'HIT',
        'cache-control': 'public, s-maxage=300',
        'content-security-policy': "script-src 'nonce-warm-secret'",
      }, '<script nonce="warm-secret"></script>');
    }
    return response({
      'cf-cache-status': 'HIT',
      'cache-control': 'public, s-maxage=300',
    });
  };

  const report = await verifyStorefront({
    baseUrl: 'https://example.test',
    expectation: 'cloudflare',
    fetchImpl,
  });
  const publicResult = report.results.find((result) => result.scenario === 'public-home');

  assert.equal(publicRequest, 11);
  assert.equal(publicResult.pass, false);
  assert.match(publicResult.reasons.join('\n'), /cold.*Set-Cookie/);
  assert.match(publicResult.reasons.join('\n'), /cold.*CF-Cache-Status/);
  assert.match(publicResult.reasons.join('\n'), /warm 4.*nonce/);
  assert.doesNotMatch(publicResult.reasons.join('\n'), /cold.*must be HIT/);
});

test('cloudflare verification makes one cold and exactly ten warm requests and reports their median TTFB', async () => {
  let clock = 0;
  let publicRequest = 0;
  const publicDurations = [100, 10, 90, 20, 80, 30, 70, 40, 60, 50, 1000];
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    const isPublicHome = parsed.pathname === '/' && parsed.search === '' && publicRequest < 11;
    const duration = isPublicHome ? publicDurations[publicRequest++] : 1;
    clock += duration;
    return response({
      'cf-cache-status': isPublicHome && publicRequest > 1 ? 'HIT' : isPublicHome ? 'MISS' : 'BYPASS',
      'cache-control': isPublicHome ? 'public, s-maxage=300' : 'private, no-store',
    });
  };

  const report = await verifyStorefront({
    baseUrl: 'https://example.test',
    expectation: 'cloudflare',
    fetchImpl,
    now: () => clock,
  });
  const publicResult = report.results.find((result) => result.scenario === 'public-home');

  assert.equal(publicRequest, 11);
  assert.equal(publicResult.coldTtfbMs, 100);
  assert.equal(publicResult.warmRequests, 10);
  assert.equal(publicResult.ttfbMs, 55);
  assert.equal(median(publicDurations.slice(1)), 55);
});

test('reports redact Set-Cookie values and do not expose query signatures', async () => {
  const fetchImpl = async () => response({
    'cf-cache-status': 'BYPASS',
    'cache-control': 'private, no-store',
    'set-cookie': 'petposture-session=top-secret',
  });

  const report = await verifyStorefront({
    baseUrl: 'https://example.test',
    expectation: 'baseline',
    fetchImpl,
  });
  const serialized = JSON.stringify(report);

  assert.match(serialized, /\[REDACTED\]/);
  assert.doesNotMatch(serialized, /top-secret/);
  assert.doesNotMatch(serialized, /invalid-test-signature/);
});
