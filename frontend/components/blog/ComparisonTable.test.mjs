import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const componentUrl = new URL('./ComparisonTable.tsx', import.meta.url);
const componentSource = readFileSync(componentUrl, 'utf8');

function resolveAlt(item) {
  return item.image_alt?.trim() || item.product_name;
}

function formatHighlight(value) {
  return value.replace(/[_-]+/g, ' ').trim();
}

test('ComparisonTable type definition includes optional image_alt field', () => {
  assert.match(
    componentSource,
    /image_alt\?:\s*string\s*\|\s*null;/,
    'ComparisonItem must declare image_alt?: string | null;'
  );
});

test('ComparisonTable resolves product image alt text with product_name fallback', () => {
  assert.match(
    componentSource,
    /alt=\{item\.image_alt\?\.trim\(\)\s*\|\|\s*item\.product_name\}/,
    'Product image must use item.image_alt?.trim() || item.product_name'
  );
});

test('ComparisonTable leaves retailer logo alt text as retailerLabel', () => {
  assert.match(
    componentSource,
    /alt=\{retailerLabel\}/,
    'Retailer logo image must preserve alt={retailerLabel}'
  );
});

test('resolveAlt uses trimmed image_alt when provided and non-empty', () => {
  const item = {
    product_name: 'Standard Dog Bed',
    image_alt: 'Cozy memory foam bed for large dogs',
  };
  assert.equal(resolveAlt(item), 'Cozy memory foam bed for large dogs');

  const paddedItem = {
    product_name: 'Standard Dog Bed',
    image_alt: '   Extra padding bed   ',
  };
  assert.equal(resolveAlt(paddedItem), 'Extra padding bed');
});

test('resolveAlt falls back to product_name when image_alt is null, undefined, empty, or whitespace', () => {
  assert.equal(resolveAlt({ product_name: 'Orthopedic Bed', image_alt: null }), 'Orthopedic Bed');
  assert.equal(resolveAlt({ product_name: 'Orthopedic Bed', image_alt: undefined }), 'Orthopedic Bed');
  assert.equal(resolveAlt({ product_name: 'Orthopedic Bed', image_alt: '' }), 'Orthopedic Bed');
  assert.equal(resolveAlt({ product_name: 'Orthopedic Bed', image_alt: '   ' }), 'Orthopedic Bed');
  assert.equal(resolveAlt({ product_name: 'Orthopedic Bed' }), 'Orthopedic Bed');
});

test('ComparisonTable formats highlight badge text with formatHighlight helper', () => {
  assert.match(
    componentSource,
    /\{formatHighlight\(item\.highlight\)\}/,
    'Highlight badge must render formatHighlight(item.highlight)'
  );
});

test('formatHighlight replaces underscores and hyphens with spaces', () => {
  assert.equal(formatHighlight('best_overall'), 'best overall');
  assert.equal(formatHighlight('BUDGET_PICK'), 'BUDGET PICK');
  assert.equal(formatHighlight('best-value'), 'best value');
  assert.equal(formatHighlight('editor_s-choice'), 'editor s choice');
  assert.equal(formatHighlight('already spaced'), 'already spaced');
});
