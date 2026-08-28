import assert from "node:assert/strict";
import test from "node:test";
import { buildContentSecurityPolicy } from "./content-security-policy.ts";

const contentSecurityPolicy = buildContentSecurityPolicy("test-nonce");

test("CSP uses a nonce and blocks unsafe inline scripts and embedding", () => {
    assert.match(contentSecurityPolicy, /default-src 'self'/);
    assert.match(contentSecurityPolicy, /script-src 'self' 'nonce-test-nonce' 'strict-dynamic'/);
    assert.doesNotMatch(contentSecurityPolicy, /script-src[^;]*'unsafe-inline'/);
    assert.match(contentSecurityPolicy, /object-src 'none'/);
    assert.match(contentSecurityPolicy, /base-uri 'self'/);
    assert.match(contentSecurityPolicy, /frame-ancestors 'none'/);
});

test("CSP preserves approved checkout and analytics providers", () => {
    for (const origin of [
        "https://js.stripe.com",
        "https://www.paypal.com",
        "https://maps.googleapis.com",
        "https://www.googletagmanager.com",
        "https://challenges.cloudflare.com",
    ]) {
        assert.match(contentSecurityPolicy, new RegExp(origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
});
