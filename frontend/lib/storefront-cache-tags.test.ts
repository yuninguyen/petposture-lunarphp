import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import * as tags from './storefront-cache-tags';

// Execute the actual unexported fetch helpers, without loading client providers/fonts.
// This verifies fetch options; real Next cache behavior belongs to C4.
async function callFetchHelper(file: string, name: string) {
  const source = readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const helper = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
  expect(helper, name).toBeDefined();
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
  const javascript = ts.transpileModule(helper!.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  await runInNewContext(`${javascript}\n${name}()`, {
    ...tags, fetch, getApiBaseUrl: () => 'http://127.0.0.1:49999', process: { env: { NEXT_PUBLIC_API_URL: 'http://127.0.0.1:49999' } },
  });
  return { source, fetch };
}

describe('homepage shared tag consumers retain TTLs', () => {
  it.each([
    ['app/page.tsx', 'fetchHeroImage', '/api/site-media?collection=banner', 300, 'storefront-site-media'],
    ['app/page.tsx', 'fetchSiteSettings', '/api/settings', 3600, 'storefront-settings'],
    ['app/layout.tsx', 'getShopSettings', '/api/settings', 3600, 'storefront-settings'],
  ] as const)('%s %s sends fixed tag and existing TTL', async (file, helper, path, ttl, tag) => {
    const { fetch, source } = await callFetchHelper(file, helper);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(`http://127.0.0.1:49999${path}`, { next: { revalidate: ttl, tags: [tag] } });
    expect(source).toMatch(/import \{[^}]*STOREFRONT_[^}]*\} from ['"]@\/lib\/storefront-cache-tags['"]/);
    expect(source).not.toMatch(/\b(?:headers|connection)\s*\(|force-dynamic|no-store/);
  });
  it('keeps metadata and RootLayout on the tagged shared settings helper', () => {
    const source = readFileSync('app/layout.tsx', 'utf8');
    expect(source).toMatch(/function generateMetadata\([^]*?await getShopSettings\(\)/);
    expect(source).toMatch(/function RootLayout\([^]*?await getShopSettings\(\)/);
  });
});
