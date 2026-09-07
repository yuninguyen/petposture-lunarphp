import { describe, expect, it } from 'vitest';
import {
  buildPrivateContentSecurityPolicy,
  buildPublicContentSecurityPolicy,
  containsRequestNonce,
} from './content-security-policy';

const preservedDirectives = [
  "default-src 'self'",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.paypal.com https://www.sandbox.paypal.com https://challenges.cloudflare.com",
  "media-src 'self' https:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];

const preservedScriptOrigins = [
  'https://js.stripe.com',
  'https://www.paypal.com',
  'https://www.sandbox.paypal.com',
  'https://maps.googleapis.com',
  'https://www.googletagmanager.com',
  'https://challenges.cloudflare.com',
];

function extractDirective(policy: string, directive: string): string {
  return policy.split('; ').find((part) => part.startsWith(`${directive} `)) ?? '';
}

describe('content security policy', () => {
  it('builds deterministic public CSP without nonce or strict-dynamic', () => {
    const first = buildPublicContentSecurityPolicy();
    const second = buildPublicContentSecurityPolicy();

    expect(first).toBe(second);
    expect(first).toContain("script-src 'self' 'unsafe-inline'");
    expect(first).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
    expect(first).not.toContain('nonce-');
    expect(first).not.toContain("'strict-dynamic'");
  });

  it('builds private CSP with nonce and strict-dynamic', () => {
    const policy = buildPrivateContentSecurityPolicy('abc');

    expect(policy).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(policy).toContain("style-src 'self' 'nonce-abc' https://fonts.googleapis.com");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it.each([
    ['public', buildPublicContentSecurityPolicy()],
    ['private', buildPrivateContentSecurityPolicy('abc')],
  ])('preserves existing origins and restrictive directives in the %s CSP', (_, policy) => {
    const scriptSource = extractDirective(policy, 'script-src');

    for (const origin of preservedScriptOrigins) {
      expect(scriptSource).toContain(origin);
    }
    for (const directive of preservedDirectives) {
      expect(policy).toContain(directive);
    }
    expect(policy).toMatch(/connect-src 'self' https: wss:/);
  });

  it.each([
    "script-src 'self' 'nonce-abc'",
    "default-src 'nonce-aB09+/_-'",
    "default-src 'self'; script-src 'nonce-aB09+/_-' 'strict-dynamic'",
    '<script nonce="abc"></script>',
    '<script title=example nonce="abc"></script>',
    '<script nonce="abc def"></script>',
    "<style nonce='abc'></style>",
    "<style title='example' nonce='abc'></style>",
    '<script nonce=abc></script>',
    '<script title=example nonce=abc></script>',
    '<script title=">" nonce="abc"></script>',
    '<script nonce></script>',
  ])('detects an actual request nonce source in %s', (value) => {
    expect(containsRequestNonce(value)).toBe(true);
  });

  it.each([
    'data-nonce="abc"',
    'aria-nonce="abc"',
    'nonce-value="abc"',
    'the page nonce is abc',
    "script-src 'self' 'unsafe-inline'",
    "script-src 'nonce-abc def'",
    "script-src 'nonce- abc'",
    '<div data-nonce="abc"></div>',
    '<div aria-nonce="abc"></div>',
    '<div nonce-value="abc"></div>',
    '<div title=" nonce=abc "></div>',
  ])('rejects nonce-like text without a valid request nonce in %s', (value) => {
    expect(containsRequestNonce(value)).toBe(false);
  });
});
