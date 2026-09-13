import assert from 'node:assert/strict';
import test from 'node:test';
import { withResponsiveTables, stripHtml, withTableOfContents } from './text.ts';

test('withResponsiveTables wraps a single table with fixed accessible container', () => {
    const input = '<p>Intro</p><table><thead><tr><th>Head</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table><p>Outro</p>';
    const result = withResponsiveTables(input);

    const expected = '<p>Intro</p><div class="rich-table-scroll" role="region" aria-label="Scrollable data table" tabindex="0"><table><thead><tr><th>Head</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table></div><p>Outro</p>';
    assert.equal(result, expected);
});

test('withResponsiveTables wraps multiple independent tables in separate containers', () => {
    const input = '<table><tbody><tr><td>Table 1</td></tr></tbody></table><p>Middle</p><table><tbody><tr><td>Table 2</td></tr></tbody></table>';
    const result = withResponsiveTables(input);

    const occurrences = (result.match(/<div class="rich-table-scroll" role="region" aria-label="Scrollable data table" tabindex="0">/g) || []).length;
    assert.equal(occurrences, 2);
    assert.match(result, /Table 1<\/td><\/tr><\/tbody><\/table><\/div><p>Middle<\/p><div class="rich-table-scroll"/);
});

test('withResponsiveTables leaves non-table HTML unchanged', () => {
    const input = '<article><h2>Title</h2><p>A paragraph with <strong>bold</strong> text.</p></article>';
    assert.equal(withResponsiveTables(input), input);
});

test('withResponsiveTables handles empty, null, or undefined gracefully', () => {
    assert.equal(withResponsiveTables(''), '');
    assert.equal(withResponsiveTables(null), null);
    assert.equal(withResponsiveTables(undefined), undefined);
});

test('withResponsiveTables preserves unrelated table attributes untouched', () => {
    const tableWithAttrs = '<table width="100%" data-custom="preserved"><tbody><tr><td>Content</td></tr></tbody></table>';
    const result = withResponsiveTables(tableWithAttrs);

    assert.match(result, /<table width="100%" data-custom="preserved">/);
});

test('withResponsiveTables rebuilds a <colgroup> from the first row\'s colwidth (TipTap resize is not persisted as a real colgroup)', () => {
    const singleColumn = '<table><tbody><tr><td colwidth="180">A</td></tr></tbody></table>';
    assert.match(
        withResponsiveTables(singleColumn),
        /<table><colgroup><col style="width:180px"><\/colgroup><tbody>/
    );

    const multiColumn = '<table><tbody><tr><th colwidth="120">A</th><th colwidth="80">B</th><th>C</th></tr></tbody></table>';
    assert.match(
        withResponsiveTables(multiColumn),
        /<colgroup><col style="width:120px"><col style="width:80px"><col><\/colgroup>/
    );

    const colspanned = '<table><tbody><tr><th colspan="2" colwidth="100,140">Merged</th></tr></tbody></table>';
    assert.match(
        withResponsiveTables(colspanned),
        /<colgroup><col style="width:100px"><col style="width:140px"><\/colgroup>/
    );
});

test('withResponsiveTables skips colgroup generation when no colwidth is present or one already exists', () => {
    const noWidths = '<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>';
    assert.doesNotMatch(withResponsiveTables(noWidths), /<colgroup>/);

    const alreadyHasColgroup = '<table><colgroup><col style="width:50%"></colgroup><tbody><tr><td colwidth="180">A</td></tr></tbody></table>';
    const result = withResponsiveTables(alreadyHasColgroup);
    assert.equal((result.match(/<colgroup>/g) || []).length, 1);
    assert.match(result, /<col style="width:50%">/);
});

test('preserves existing stripHtml and withTableOfContents behavior', () => {
    assert.equal(stripHtml('<h1>Hello <strong>World</strong></h1>'), 'Hello World');

    const toc = withTableOfContents('<h2>Section One</h2><p>Text</p><h3>Subsection</h3>');
    assert.equal(toc.items.length, 2);
    assert.equal(toc.items[0].text, 'Section One');
    assert.equal(toc.items[1].text, 'Subsection');
});
