import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const accountSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const checkoutSource = readFileSync(new URL('../../components/CheckoutPage.tsx', import.meta.url), 'utf8');

function between(source, start, end, label) {
    const startIndex = source.indexOf(start);
    assert.notEqual(startIndex, -1, `${label}: start marker is missing`);

    const endIndex = source.indexOf(end, startIndex + start.length);
    assert.notEqual(endIndex, -1, `${label}: end marker is missing`);

    return source.slice(startIndex, endIndex);
}

const collapsedOrderSummary = between(
    accountSource,
    '<div className="text-right">',
    '<ChevronDown',
    'collapsed order summary',
);
const expandedTotals = between(
    accountSource,
    '<div className="pt-3 border-t border-zinc-100 space-y-1 text-sm">',
    "{returnEligibility(order) === 'open'",
    'expanded order totals',
);
const activeReturnAction = between(
    accountSource,
    "{returnEligibility(order) === 'open'",
    "{returnEligibility(order) === 'closed'",
    'active return action',
);
const closedReturnAction = between(
    accountSource,
    "{returnEligibility(order) === 'closed'",
    ") : tab === 'addresses'",
    'closed return action',
);
const billingDisplay = between(
    accountSource,
    '>Billing Address</p>',
    '{order.shipments.length > 0',
    'billing address display',
);
const separateBillingPayload = between(
    checkoutSource,
    ': buildAddressPayload({',
    'return { shippingAddress, billingAddress };',
    'separate billing payload',
);

function jsxButtons(source) {
    const sourceFile = ts.createSourceFile('contract.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const buttons = [];

    function visit(node) {
        if (ts.isJsxElement(node) && node.openingElement.tagName.getText(sourceFile) === 'button') {
            buttons.push(node);
        }
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return { sourceFile, buttons };
}

function attribute(openingElement, name) {
    return openingElement.attributes.properties.find(
        (property) => ts.isJsxAttribute(property) && property.name.getText() === name,
    );
}

function buttonWithText(source, text, label) {
    const { sourceFile, buttons } = jsxButtons(source);
    const button = buttons.find((candidate) => candidate.getText(sourceFile).includes(text));
    assert.ok(button, `${label}: button is missing`);
    return { sourceFile, button, openingElement: button.openingElement };
}

function stringAttribute(sourceFile, openingElement, name, label) {
    const target = attribute(openingElement, name);
    assert.ok(target?.initializer && ts.isStringLiteral(target.initializer), `${label}: ${name} string attribute is missing`);
    return target.initializer.text;
}

function hasTrueDisabled(openingElement) {
    const disabled = attribute(openingElement, 'disabled');
    if (!disabled) return false;
    if (!disabled.initializer) return true;
    return ts.isJsxExpression(disabled.initializer)
        && disabled.initializer.expression?.kind === ts.SyntaxKind.TrueKeyword;
}

function activeButtonContract(source) {
    const { sourceFile, openingElement } = buttonWithText(source, 'Request a Return', 'active return action');
    const handler = attribute(openingElement, 'onClick');
    assert.equal(handler?.getText(sourceFile), 'onClick={() => void handleRequestReturn(order)}');
    return stringAttribute(sourceFile, openingElement, 'className', 'active return action');
}

function hasActiveButtonStyling(className) {
    return /\bborder(?:-[^\s]+)?\b/.test(className)
        && /\bbg-[^\s]+/.test(className)
        && /\bhover:(?:bg|border|shadow)-[^\s]+/.test(className)
        && !/hover:underline/.test(className);
}

const activeReturnButtonClass = activeButtonContract(activeReturnAction);

test('active return action is a bordered button with background and visible hover feedback', () => {
    assert.equal(hasActiveButtonStyling(activeReturnButtonClass), true);
});

test('closed return action is an unconditionally disabled button rather than paragraph text', () => {
    const { openingElement } = buttonWithText(closedReturnAction, 'Request a Return', 'closed return action');
    assert.equal(hasTrueDisabled(openingElement), true);
    assert.doesNotMatch(closedReturnAction, /<p\b[^>]*>\s*Request a Return\s*<\/p>/s);
});

test('button contracts reject wrapper or descendant attributes and false disabled values', () => {
    const wrapperStyled = '<div className="border bg-white hover:bg-zinc-50"><button onClick={() => void handleRequestReturn(order)} className="text-rust">Request a Return<span className="border bg-white hover:bg-zinc-50" /></button></div>';
    const falseDisabled = '<button disabled = {false}>Request a Return<span disabled /></button>';

    assert.equal(hasActiveButtonStyling(activeButtonContract(wrapperStyled)), false);
    const { openingElement } = buttonWithText(falseDisabled, 'Request a Return', 'false-disabled mutation');
    assert.equal(hasTrueDisabled(openingElement), false);
});

test('collapsed order total shows currency before the formatted amount', () => {
    assert.match(collapsedOrderSummary, /\{order\.currency\}[\s\S]*\{order\.total\.formatted\}/);
});

test('expanded order total shows currency before the formatted amount', () => {
    assert.match(expandedTotals, /<span>Total<\/span>[\s\S]*\{order\.currency\}[\s\S]*\{order\.total\.formatted\}/);
});

test('separate billing payload carries the checkout contact phone', () => {
    assert.match(separateBillingPayload, /\bphone:\s*form\.phone\b/);
});

test('billing display falls back to the shipping phone', () => {
    assert.match(billingDisplay, /\{order\.billing_address\.phone\s*\|\|\s*order\.shipping_address\.phone\}/);
});

test('expanded totals use the exact plural Estimated Taxes label', () => {
    assert.match(expandedTotals, /<span>Estimated Taxes<\/span>/);
    assert.doesNotMatch(expandedTotals, /<span>Estimated Tax<\/span>/);
});

test('expanded totals retain the quantity-based subtotal label', () => {
    assert.match(expandedTotals, /Subtotal &middot; \{itemCount\(order\)\}/);
});
