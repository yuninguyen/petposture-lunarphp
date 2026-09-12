import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sanitizeRichHtml } from "./sanitize-rich-html.ts";

const xssPayload = '<p>Safe <strong>content</strong><img src="/pet.jpg" onerror="alert(1)"><a href="javascript:alert(2)">click</a></p><script>alert(3)</script><iframe src="https://evil.example/embed"></iframe>';
const surfaces = {
    blog: new URL("../components/BlogPostPage.tsx", import.meta.url),
    "legal page": new URL("../components/LegalPageLayout.tsx", import.meta.url),
    "product description": new URL("../components/product/ProductDetails.tsx", import.meta.url),
};

for (const [surface, componentUrl] of Object.entries(surfaces)) {
    test(`${surface} render sanitization strips executable markup`, () => {
        const sanitized = sanitizeRichHtml(xssPayload);
        const componentSource = readFileSync(componentUrl, "utf8");

        assert.match(componentSource, /sanitizeRichHtml/);
        assert.match(sanitized, /<strong>content<\/strong>/);
        assert.doesNotMatch(sanitized, /<script/i);
        assert.doesNotMatch(sanitized, /onerror/i);
        assert.doesNotMatch(sanitized, /javascript:/i);
        assert.doesNotMatch(sanitized, /<iframe/i);
    });
}

test("allows the pp-cta-* class values and their inline style, stripping any other class/style", () => {
    const withAllowedClass = sanitizeRichHtml('<a href="/shop" class="pp-cta-primary" style="background-color:#df8448">Shop now</a>');
    assert.match(withAllowedClass, /class="pp-cta-primary"/);
    assert.match(withAllowedClass, /style="background-color:#df8448"/);

    const withPillClass = sanitizeRichHtml('<a href="/shop" class="pp-cta-pill" style="border-color:#c9713a">Shop now</a>');
    assert.match(withPillClass, /class="pp-cta-pill"/);
    assert.match(withPillClass, /style="border-color:#c9713a"/);

    const withArbitraryClass = sanitizeRichHtml('<a href="/shop" class="evil-tracker pp-cta-primary">Shop now</a>');
    assert.match(withArbitraryClass, /class="pp-cta-primary"/);
    assert.doesNotMatch(withArbitraryClass, /evil-tracker/);

    const withOnlyDisallowedClass = sanitizeRichHtml('<a href="/shop" class="some-other-class">Shop now</a>');
    assert.doesNotMatch(withOnlyDisallowedClass, /class=/);

    const styleWithoutCtaClass = sanitizeRichHtml('<p style="color:red">not a cta</p>');
    assert.doesNotMatch(styleWithoutCtaClass, /style=/);
});
