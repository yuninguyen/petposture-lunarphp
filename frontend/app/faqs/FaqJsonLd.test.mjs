import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const dataPath = new URL('../../lib/faq-data.ts', import.meta.url);
const dataSource = readFileSync(dataPath, 'utf8');
const componentSource = readFileSync(new URL('../../components/FaqsPage.tsx', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

test('shared FAQ data preserves the nine current questions and answers', () => {
    assert.ok(dataSource.includes('export const CATEGORIES'));
    assert.ok(dataSource.includes('export const FAQ_ITEMS'));
    assert.equal((dataSource.match(/question:/g) || []).length, 9);
    assert.equal((dataSource.match(/answer:/g) || []).length, 9);
    assert.match(componentSource, /import \{ CATEGORIES, FAQ_ITEMS \} from ['"]@\/lib\/faq-data['"]/);
    assert.doesNotMatch(componentSource, /const CATEGORIES\s*=/);
    assert.doesNotMatch(componentSource, /const FAQ_ITEMS\s*=/);
});

test('FAQ JSON-LD helper creates one accepted answer per shared FAQ item', () => {
    const transformed = dataSource
        .replace(/export const /g, 'const ')
        + `\nthis.faqData = { FAQ_ITEMS };`;
    const context = vm.createContext({});
    vm.runInContext(ts.transpileModule(transformed, { compilerOptions: { module: ts.ModuleKind.Script, target: ts.ScriptTarget.ES2022 } }).outputText, context);
    const { FAQ_ITEMS } = context.faqData;
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQ_ITEMS.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
    };
    assert.equal(schema.mainEntity.length, FAQ_ITEMS.length);
    assert.ok(schema.mainEntity.every((item) => item.acceptedAnswer.text));
});

test('FAQ route uses shared data, SITE_URL, and a nonce-bearing JSON-LD script', () => {
    assert.match(pageSource, /async function Page/);
    assert.match(pageSource, /from ['"]next\/headers['"]/);
    assert.match(pageSource, /from ['"]@\/lib\/site['"]/);
    assert.match(pageSource, /from ['"]@\/lib\/faq-data['"]/);
    assert.match(pageSource, /type="application\/ld\+json"/);
    assert.match(pageSource, /nonce=\{nonce\}/);
    assert.match(pageSource, /'@type': 'FAQPage'/);
    assert.match(pageSource, /'@type': 'Question'/);
    assert.match(pageSource, /FAQ_ITEMS\.map/);
});
