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

test("allows table elements with colgroup, col, and safe metadata attributes", () => {
    const rawTable = `
        <table width="100%">
            <colgroup>
                <col width="150px">
                <col width="50%">
                <col width="120">
            </colgroup>
            <thead>
                <tr>
                    <th scope="col" colspan="2" colwidth="150,200">Header 1</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td rowspan="2" colwidth="100">Cell 1</td>
                    <td>Cell 2</td>
                </tr>
            </tbody>
        </table>
    `;
    const sanitized = sanitizeRichHtml(rawTable);

    assert.match(sanitized, /<table width="100%">/);
    assert.match(sanitized, /<colgroup>/);
    assert.match(sanitized, /<col width="150px">/);
    assert.match(sanitized, /<col width="50%">/);
    assert.match(sanitized, /<col width="120">/);
    assert.match(sanitized, /<th scope="col" colspan="2" colwidth="150,200">/);
    assert.match(sanitized, /<td rowspan="2" colwidth="100">/);
});

test("strips disallowed attributes, classes, styles, and event handlers from tables", () => {
    const dirtyTable = `
        <table class="injected-class" style="color:red" onclick="alert('xss')" data-tracker="evil" width="invalid(width)">
            <colgroup>
                <col class="col-class" style="width:100px" width="100px; evil" colwidth="bad">
            </colgroup>
            <tbody>
                <tr onmouseover="alert(1)" class="row-class" style="background:red">
                    <th class="th-class" style="color:blue" scope="col" colwidth="100">Header</th>
                    <td class="td-class" style="color:green" data-secret="123" colwidth="not-num">Data</td>
                </tr>
            </tbody>
        </table>
    `;
    const sanitized = sanitizeRichHtml(dirtyTable);

    assert.doesNotMatch(sanitized, /injected-class/);
    assert.doesNotMatch(sanitized, /col-class/);
    assert.doesNotMatch(sanitized, /row-class/);
    assert.doesNotMatch(sanitized, /th-class/);
    assert.doesNotMatch(sanitized, /td-class/);
    assert.doesNotMatch(sanitized, /class=/);
    assert.doesNotMatch(sanitized, /style=/);
    assert.doesNotMatch(sanitized, /onclick/);
    assert.doesNotMatch(sanitized, /onmouseover/);
    assert.doesNotMatch(sanitized, /data-/);
    assert.doesNotMatch(sanitized, /invalid\(width\)/);
    assert.doesNotMatch(sanitized, /colwidth="bad"/);
    assert.doesNotMatch(sanitized, /colwidth="not-num"/);
    assert.match(sanitized, /colwidth="100"/);
    assert.match(sanitized, /scope="col"/);
});

test("strips forged wrapper role, aria-label, and tabindex from untrusted HTML", () => {
    const forgedWrapper = '<div class="rich-table-scroll" role="region" aria-label="Scrollable data table" tabindex="0"><table><tbody><tr><td>Safe</td></tr></tbody></table></div>';
    const sanitized = sanitizeRichHtml(forgedWrapper);

    assert.doesNotMatch(sanitized, /role=/);
    assert.doesNotMatch(sanitized, /aria-label=/);
    assert.doesNotMatch(sanitized, /tabindex=/);
    assert.doesNotMatch(sanitized, /rich-table-scroll/);
    assert.match(sanitized, /<table><tbody><tr><td>Safe<\/td><\/tr><\/tbody><\/table>/);
});

test("rejects width attribute on elements other than table, col, and img", () => {
    const withParaWidth = sanitizeRichHtml('<p width="100%">Paragraph</p><div width="200">Div</div>');
    assert.doesNotMatch(withParaWidth, /width=/);
});

