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
