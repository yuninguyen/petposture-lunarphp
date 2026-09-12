import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { sanitizeRichHtml } from '../../lib/sanitize-rich-html.ts';
import { withTableOfContents, withResponsiveTables } from '../../lib/text.ts';

const blogPostPageUrl = new URL('../BlogPostPage.tsx', import.meta.url);
const blogPostPageSource = readFileSync(blogPostPageUrl, 'utf8');

const globalsCssUrl = new URL('../../app/globals.css', import.meta.url);
const globalsCssSource = readFileSync(globalsCssUrl, 'utf8');

test('BlogPostPage processes content in strict order: sanitizeRichHtml -> withTableOfContents -> withResponsiveTables -> render', () => {
    assert.match(blogPostPageSource, /withResponsiveTables/);

    const sanitizeIndex = blogPostPageSource.indexOf('sanitizeRichHtml(');
    const tocIndex = blogPostPageSource.indexOf('withTableOfContents(');
    const responsiveIndex = blogPostPageSource.indexOf('withResponsiveTables(');
    const renderIndex = blogPostPageSource.indexOf('dangerouslySetInnerHTML');

    assert.ok(sanitizeIndex !== -1, 'BlogPostPage must call sanitizeRichHtml');
    assert.ok(tocIndex !== -1, 'BlogPostPage must call withTableOfContents');
    assert.ok(responsiveIndex !== -1, 'BlogPostPage must call withResponsiveTables');
    assert.ok(renderIndex !== -1, 'BlogPostPage must render via dangerouslySetInnerHTML');

    assert.ok(sanitizeIndex < tocIndex, 'sanitizeRichHtml must run before withTableOfContents');
    assert.ok(tocIndex < responsiveIndex, 'withTableOfContents must run before withResponsiveTables');
    assert.ok(responsiveIndex < renderIndex, 'withResponsiveTables must run before render');
});

test('BlogPostPage article includes rich-content scope and removes conflicting inline table styles', () => {
    assert.match(blogPostPageSource, /class(Name)?="[^"]*rich-content/);
    assert.doesNotMatch(blogPostPageSource, /\[&_table\]:w-full/);
    assert.doesNotMatch(blogPostPageSource, /\[&_thead\]:bg-secondary-light/);
});

test('full pipeline sanitizes, adds TOC anchors, and wraps tables', () => {
    const rawContent = `
        <h2>Comparison Overview</h2>
        <p>Introduction text</p>
        <table width="100%">
            <tbody>
                <tr>
                    <th scope="col" colspan="2" colwidth="150,200">Feature</th>
                </tr>
                <tr>
                    <td>Detail 1</td>
                    <td>Detail 2</td>
                </tr>
            </tbody>
        </table>
        <script>alert("xss")</script>
    `;

    const sanitized = sanitizeRichHtml(rawContent);
    const withToc = withTableOfContents(sanitized).html;
    const finalHtml = withResponsiveTables(withToc);

    assert.doesNotMatch(finalHtml, /<script/i);
    assert.match(finalHtml, /<h2 id="comparison-overview">/);
    assert.match(finalHtml, /<div class="rich-table-scroll" role="region" aria-label="Scrollable data table" tabindex="0"><table width="100%">/);
    assert.match(finalHtml, /<th scope="col" colspan="2" colwidth="150,200">Feature<\/th>/);
    assert.match(finalHtml, /<\/table><\/div>/);
});

test('globals.css provides scoped responsive table styling including tbody th and focus state', () => {
    assert.match(globalsCssSource, /\.rich-content\s+\.rich-table-scroll/);
    assert.match(globalsCssSource, /overflow-x:\s*auto/);
    assert.match(globalsCssSource, /overscroll-behavior-x:\s*contain/);
    assert.match(globalsCssSource, /:focus-visible/);
    assert.match(globalsCssSource, /tbody\s+th/);
    assert.match(globalsCssSource, /thead\s+th/);
    assert.match(globalsCssSource, /tbody\s+tr:nth-child\(even\)/);
});
