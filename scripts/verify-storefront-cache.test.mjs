import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateResponse } from './verify-storefront-cache.mjs';

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
