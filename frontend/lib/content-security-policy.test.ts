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
    for (const origin of preservedScriptOrigins) {
      expect(policy).toContain(origin);
    }
    for (const directive of preservedDirectives) {
      expect(policy).toContain(directive);
    }
    expect(policy).toMatch(/connect-src 'self' https: wss:/);
  });

  it('detects request nonce sources without matching unrelated text', () => {
    expect(containsRequestNonce("script-src 'self' 'nonce-abc'")).toBe(true);
    expect(containsRequestNonce('<script nonce="abc"></script>')).toBe(true);
    expect(containsRequestNonce('<style nonce=abc></style>')).toBe(true);
    expect(containsRequestNonce('nonce-value')).toBe(false);
    expect(containsRequestNonce("script-src 'self' 'unsafe-inline'")).toBe(false);
  });
});
