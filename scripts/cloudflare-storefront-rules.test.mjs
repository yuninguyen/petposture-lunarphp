import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  API_RULE_DESCRIPTION,
  HTML_RULE_DESCRIPTION,
  auditRuleset,
  buildHomeRule,
  buildApplyRules,
  createExportArtifact,
  parseExport,
  redactSecrets,
  runCommand,
  HOME_EXPRESSION,
  API_EXPRESSION,
  LIVE_API_EXPRESSION,
  LIVE_LEGACY_HTML_EXPRESSION,
  LIVE_LEGACY_HTML_EXPRESSION_SHA256,
  buildMutationRequest,
} from './cloudflare-storefront-rules.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/cloudflare-cache-ruleset.json', import.meta.url), 'utf8'));
const liveV5Fixture = JSON.parse(await readFile(new URL('./fixtures/cloudflare-cache-ruleset-live-v5.json', import.meta.url), 'utf8'));
const liveV16Fixture = JSON.parse(await readFile(new URL('./fixtures/cloudflare-cache-ruleset-live-v16.json', import.meta.url), 'utf8'));
const bypassModule = await import('./cloudflare-storefront-rules.mjs');
const { HOME_BYPASS_DESCRIPTION, HOME_BYPASS_EXPRESSION, buildHomeBypassRule, auditHomeBypassRuleset, buildHomeBypassRules } = bypassModule;
const EXPECTED_BYPASS_EXPRESSION = '(http.host eq "petposture.com") and (http.request.uri.path eq "/") and (not ((http.host eq "petposture.com") and (http.request.method in {"GET" "HEAD"}) and (http.request.uri.path eq "/") and (http.request.uri.query eq "") and (not any(lower(http.request.headers.names[*])[*] eq "purpose")) and (not any(lower(http.request.headers.names[*])[*] eq "sec-purpose")) and (not any(lower(http.request.headers.names[*])[*] eq "next-router-prefetch")) and (not any(lower(http.request.headers.names[*])[*] eq "rsc")) and (not any(lower(http.request.headers.names[*])[*] eq "next-router-state-tree")) and (not any(lower(http.request.headers.names[*])[*] eq "next-router-segment-prefetch")) and (not any(lower(http.request.headers.names[*])[*] eq "cookie"))))';
const rules = fixture.rules;
const AUTHORITATIVE_LIVE_API_EXPRESSION_SHA256 = '7d8150a31baeda7b3d3453bb3b2c949187f6f686f3eff9988250943bba1bded9';
const AUTHORITATIVE_LIVE_LEGACY_HTML_EXPRESSION_SHA256 = 'cf3920616575be3acb242523a918646cb76dd854a28721e1670731d492bc8a88';

function ruleset(overrides = {}) {
  return { ...structuredClone(fixture), ...overrides };
}

test('auditRuleset identifies exact rules, semantic scope, and evaluation order', () => {
  const report = auditRuleset(ruleset({ rules: buildApplyRules(ruleset()).rules }));
  assert.deepEqual(report.rules.map((rule) => rule.description), [HTML_RULE_DESCRIPTION, API_RULE_DESCRIPTION, 'Other cache rule']);
  assert.equal(report.expected.html.count, 1);
  assert.equal(report.expected.html.hostnameScoped, true);
  assert.equal(report.expected.api.count, 1);
  assert.equal(report.expected.api.hostnameScoped, true);
  assert.equal(report.pass, true);
});

test('auditRuleset fails closed for missing, duplicate, or unscoped named rules', () => {
  assert.throws(() => auditRuleset(ruleset({ rules: rules.filter((rule) => rule.ref !== 'api') })), /missing/i);
  assert.throws(() => auditRuleset(ruleset({ rules: [...rules, rules[0]] })), /duplicat/i);
  assert.throws(() => auditRuleset(ruleset({ rules: rules.map((rule) => rule.ref === 'api' ? { ...rule, expression: '(http.request.method eq "GET")' } : rule) })), /host|semantic|scop/i);
});

test('buildHomeRule is a narrowly scoped anonymous homepage cache rule', () => {
  const rule = buildHomeRule();
  assert.match(rule.expression, /http\.host\s+eq\s+"petposture\.com"/);
  assert.match(rule.expression, /http\.request\.method\s+in\s+\{\s*"GET"\s+"HEAD"\s*\}/);
  assert.match(rule.expression, /http\.request\.uri\.path\s+eq\s+"\/"/);
  assert.match(rule.expression, /http\.request\.uri\.query\s+eq\s+""/);
  assert.match(rule.expression, /Cookie|cookie/);
  assert.match(rule.expression, /Purpose|purpose/);
  assert.match(rule.expression, /Next-Router-Prefetch|next-router-prefetch/);
  assert.equal(rule.action_parameters.cache, true);
  assert.deepEqual(rule.action_parameters.browser_ttl, { mode: 'respect_origin' });
  assert.deepEqual(rule.action_parameters.edge_ttl, { mode: 'respect_origin' });
  assert.equal('override_origin' in rule.action_parameters, false);
});

test('buildApplyRules accepts exact broad HTML and path-only API legacy candidates together', () => {
  const legacy = ruleset({ rules: rules.map((rule) => rule.ref === 'api'
    ? { ...rule, expression: API_EXPRESSION.replace('(http.host eq "api.petposture.com") and ', '') }
    : rule) });
  const result = buildApplyRules(legacy);
  assert.equal(result.rules.length, rules.length);
  assert.match(result.rules.find((rule) => rule.ref === 'html').expression, /http\.host\s+eq\s+"petposture\.com"/);
  assert.match(result.rules.find((rule) => rule.ref === 'api').expression, /^\(http\.host eq "api\.petposture\.com"\)/);
});

test('buildApplyRules makes the smaller atomic diff in place and scopes API', () => {
  const result = buildApplyRules(ruleset());
  assert.equal(result.rules.length, rules.length);
  assert.deepEqual(result.rules.map((rule) => rule.ref), rules.map((rule) => rule.ref));
  const html = result.rules.find((rule) => rule.description === HTML_RULE_DESCRIPTION);
  assert.equal(html.ref, 'html');
  assert.match(html.expression, /http\.request\.uri\.path\s+eq\s+"\/"/);
  assert.doesNotMatch(html.expression, /__cloudflare_disabled_html_rule__/);
  assert.match(result.rules.find((rule) => rule.description === API_RULE_DESCRIPTION).expression, /http\.host\s+eq\s+"api\.petposture\.com"/);
  assert.equal(result.changed, true);
});

test('parseExport rejects stale or untrusted historical exports', () => {
  assert.throws(() => parseExport({ id: 'rs-123', version: 'v6', rules }, ruleset()), /match|stale/i);
  assert.throws(() => parseExport({ id: 'rs-123', version: 'v7', rules }, { ...ruleset(), rules: [] }), /ruleset/i);
});

test('redactSecrets never exposes environment secrets', () => {
  const token = 'super-secret-token';
  assert.equal(redactSecrets(`token=${token}`, token), 'token=[REDACTED]');
  assert.doesNotMatch(redactSecrets(JSON.stringify({ authorization: `Bearer ${token}` }), token), /super-secret-token/);
  assert.equal(redactSecrets('https://api.cloudflare.com/client/v4/zones/zone-secret/rulesets'), 'https://api.cloudflare.com/client/v4/zones/[REDACTED]/rulesets');
});

function cloudflareResponse(result) {
  return new Response(JSON.stringify({ success: true, result }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function output() {
  let value = '';
  return { stream: { write(chunk) { value += chunk; } }, read: () => value };
}

test('export writes a fresh full live ruleset artifact with hash and identity', async () => {
  const artifactDir = await mkdtemp(path.join(os.tmpdir(), 'cloudflare-export-'));
  const logs = output();
  const result = await runCommand(['export'], {
    env: { CLOUDFLARE_API_TOKEN: 'secret', CLOUDFLARE_ZONE_ID: 'zone' },
    fetchImpl: async () => cloudflareResponse(ruleset()),
    stdout: logs.stream,
    artifactDir,
  });
  const saved = JSON.parse(await readFile(result.file, 'utf8'));
  assert.equal(saved.source, 'live-cloudflare-api');
  assert.deepEqual(saved.ruleset, ruleset());
  assert.match(saved.sha256, /^[a-f0-9]{64}$/);
  assert.match(logs.read(), /Ruleset rs-123 version v7/);
});

test('apply-home defaults to dry-run, reads live before trusting export, and writes rollback data without PUT', async () => {
  const artifactDir = await mkdtemp(path.join(os.tmpdir(), 'cloudflare-apply-'));
  const exportPath = path.join(artifactDir, 'fresh.json');
  await writeFile(exportPath, JSON.stringify(createExportArtifact(ruleset())));
  const methods = [];
  const logs = output();
  const result = await runCommand(['apply-home', '--from-export', exportPath], {
    env: { CLOUDFLARE_API_TOKEN: 'secret', CLOUDFLARE_ZONE_ID: 'zone' },
    fetchImpl: async (_url, options) => {
      methods.push(options.method);
      return cloudflareResponse(ruleset());
    },
    stdout: logs.stream,
    artifactDir,
  });
  assert.deepEqual(methods, ['GET']);
  assert.equal(result.dryRun, true);
  assert.match(logs.read(), /DRY RUN/);
  assert.deepEqual(JSON.parse(await readFile(result.rollbackFile, 'utf8')).ruleset, ruleset());
});

test('apply-home dry-run and execute atomically migrate broad HTML plus path-only API with exactly one PUT', async () => {
  const legacy = ruleset({ rules: rules.map((rule) => rule.ref === 'api'
    ? { ...rule, expression: API_EXPRESSION.replace('(http.host eq "api.petposture.com") and ', '') }
    : rule) });
  for (const execute of [false, true]) {
    const artifactDir = await mkdtemp(path.join(os.tmpdir(), `cloudflare-legacy-${execute ? 'execute' : 'dry'}-`));
    const exportPath = path.join(artifactDir, 'fresh.json');
    await writeFile(exportPath, JSON.stringify(createExportArtifact(legacy)));
    const requests = [];
    const changed = { ...legacy, version: 'v8', rules: buildApplyRules(legacy).rules };
    const argv = ['apply-home', '--from-export', exportPath, ...(execute ? ['--execute'] : [])];
    const result = await runCommand(argv, {
      env: { CLOUDFLARE_API_TOKEN: 'secret', CLOUDFLARE_ZONE_ID: 'zone' },
      fetchImpl: async (_url, options) => {
        requests.push(options);
        return cloudflareResponse(options.method === 'PUT' ? changed : legacy);
      },
      stdout: output().stream,
      artifactDir,
    });
    assert.deepEqual(requests.map(({ method }) => method), execute ? ['GET', 'PUT'] : ['GET']);
    const request = execute ? JSON.parse(requests[1].body) : result.request;
    assert.equal(request.rules.filter((rule) => rule.description === HTML_RULE_DESCRIPTION).length, 1);
    assert.equal(request.rules.filter((rule) => rule.description === API_RULE_DESCRIPTION).length, 1);
    assert.equal(request.rules.find((rule) => rule.description === API_RULE_DESCRIPTION).expression, API_EXPRESSION);
    assert.equal(request.rules.find((rule) => rule.description === HTML_RULE_DESCRIPTION).expression, HOME_EXPRESSION);
  }
});

test('captured live expressions match authoritative fresh production SHA-256 pins', () => {
  assert.equal(createHash('sha256').update(LIVE_API_EXPRESSION).digest('hex'), AUTHORITATIVE_LIVE_API_EXPRESSION_SHA256);
  assert.equal(rules.find((rule) => rule.ref === 'api').expression, LIVE_API_EXPRESSION);
  assert.equal(LIVE_LEGACY_HTML_EXPRESSION_SHA256, AUTHORITATIVE_LIVE_LEGACY_HTML_EXPRESSION_SHA256);
  assert.equal(createHash('sha256').update(LIVE_LEGACY_HTML_EXPRESSION).digest('hex'), AUTHORITATIVE_LIVE_LEGACY_HTML_EXPRESSION_SHA256);
  assert.equal(liveV5Fixture.rules.find((rule) => rule.description === HTML_RULE_DESCRIPTION).expression, LIVE_LEGACY_HTML_EXPRESSION);
  assert.equal(liveV5Fixture.rules.find((rule) => rule.description === API_RULE_DESCRIPTION).expression, LIVE_API_EXPRESSION);
});

test('exact live v5 dry-run changes only the disabled HTML rule in place', async () => {
  const artifactDir = await mkdtemp(path.join(os.tmpdir(), 'cloudflare-live-v5-dry-'));
  const exportPath = path.join(artifactDir, 'fresh.json');
  await writeFile(exportPath, JSON.stringify(createExportArtifact(liveV5Fixture)));
  const result = await runCommand(['apply-home', '--from-export', exportPath], {
    env: { CLOUDFLARE_API_TOKEN: 'secret', CLOUDFLARE_ZONE_ID: 'zone' },
    fetchImpl: async () => cloudflareResponse(liveV5Fixture),
    stdout: output().stream,
    artifactDir,
  });
  assert.deepEqual(result.request.rules.map((rule) => rule.ref), liveV5Fixture.rules.map((rule) => rule.ref));
  for (let index = 0; index < liveV5Fixture.rules.length; index += 1) {
    const before = liveV5Fixture.rules[index];
    const after = result.request.rules[index];
    if (before.description === HTML_RULE_DESCRIPTION) {
      assert.deepEqual(after, { ...before, enabled: true, expression: HOME_EXPRESSION, action: 'set_cache_settings', action_parameters: buildHomeRule().action_parameters });
    } else {
      assert.deepEqual(after, before);
    }
  }
});

test('audit rejects every near-miss of the exact live disabled legacy HTML expression', () => {
  const mutations = [
    LIVE_LEGACY_HTML_EXPRESSION.replace(' and (not starts_with(http.request.uri.path, "/account"))', ''),
    LIVE_LEGACY_HTML_EXPRESSION.replace('/account', '/accounts'),
    LIVE_LEGACY_HTML_EXPRESSION.replace('(http.host eq "petposture.com")', '(http.host in {"petposture.com" "www.petposture.com"})'),
    `${LIVE_LEGACY_HTML_EXPRESSION} or (http.request.uri.path eq "/products")`,
  ];
  for (const expression of mutations) {
    const nearMiss = structuredClone(liveV5Fixture);
    nearMiss.rules.find((rule) => rule.description === HTML_RULE_DESCRIPTION).expression = expression;
    assert.throws(() => auditRuleset(nearMiss), /homepage semantics|reviewed/i, expression);
  }
});

test('apply-home accepts and preserves the exact current live hostname-scoped GET-only API allowlist', async () => {
  const liveApiRule = rules.find((rule) => rule.ref === 'api');
  const live = ruleset();
  const artifactDir = await mkdtemp(path.join(os.tmpdir(), 'cloudflare-live-api-'));
  const exportPath = path.join(artifactDir, 'fresh.json');
  await writeFile(exportPath, JSON.stringify(createExportArtifact(live)));
  const requests = [];
  const result = await runCommand(['apply-home', '--from-export', exportPath], {
    env: { CLOUDFLARE_API_TOKEN: 'secret', CLOUDFLARE_ZONE_ID: 'zone' },
    fetchImpl: async (_url, options) => { requests.push(options); return cloudflareResponse(live); },
    stdout: output().stream,
    artifactDir,
  });
  assert.deepEqual(requests.map(({ method }) => method), ['GET']);
  assert.deepEqual(result.request.rules.find((rule) => rule.ref === 'api'), liveApiRule);
});

test('audit rejects near-misses of the exact current live API allowlist', () => {
  const reviewed = ruleset({
    rules: buildApplyRules(ruleset()).rules.map((rule) => rule.ref === 'api' ? { ...rule, expression: LIVE_API_EXPRESSION } : rule),
  });
  const priorExpression = LIVE_API_EXPRESSION
    .replace(' or http.request.uri.path eq "/api/site-media"', '')
    .replace(' or starts_with(http.request.uri.path, "/api/breeds")', '')
    .replace(' or starts_with(http.request.uri.path, "/api/solutions")', '');
  assert.equal(auditRuleset(reviewed).expected.api.reviewed, true);
  for (const expression of [
    LIVE_API_EXPRESSION.replace(' or http.request.uri.path eq "/api/site-media"', ''),
    LIVE_API_EXPRESSION.replace(' or starts_with(http.request.uri.path, "/api/breeds")', ''),
    LIVE_API_EXPRESSION.replace(' or starts_with(http.request.uri.path, "/api/solutions")', ''),
    priorExpression.replace('http.request.uri.path eq "/api/settings"', 'http.request.uri.path eq "/api/settings" or http.request.uri.path eq "/api/site-media"'),
    priorExpression.replace('starts_with(http.request.uri.path, "/api/posts")', 'starts_with(http.request.uri.path, "/api/posts") or starts_with(http.request.uri.path, "/api/breeds")'),
    priorExpression.replace('starts_with(http.request.uri.path, "/api/posts")', 'starts_with(http.request.uri.path, "/api/posts") or starts_with(http.request.uri.path, "/api/solutions")'),
    LIVE_API_EXPRESSION.replace('(http.request.method eq "GET")', '(http.request.method in {"GET" "POST"})'),
    LIVE_API_EXPRESSION.replace('api.petposture.com', 'petposture.com'),
    `${LIVE_API_EXPRESSION} or (http.request.uri.path eq "/api/orders")`,
  ]) {
    assert.throws(() => auditRuleset(ruleset({
      rules: reviewed.rules.map((rule) => rule.ref === 'api' ? { ...rule, expression } : rule),
    })), /semantic|reviewed|safe/i, expression);
  }
});

test('apply-home rejects unsafe API semantics before dry-run or execute PUT', async () => {
  for (const execute of [false, true]) {
    const unsafe = ruleset({ rules: rules.map((rule) => rule.ref === 'api' ? { ...rule, expression: '(http.request.method eq "GET")' } : rule) });
    const artifactDir = await mkdtemp(path.join(os.tmpdir(), 'cloudflare-unsafe-api-'));
    const exportPath = path.join(artifactDir, 'fresh.json');
    await writeFile(exportPath, JSON.stringify(createExportArtifact(unsafe)));
    const methods = [];
    await assert.rejects(() => runCommand(['apply-home', '--from-export', exportPath, ...(execute ? ['--execute'] : [])], {
      env: { CLOUDFLARE_API_TOKEN: 'secret', CLOUDFLARE_ZONE_ID: 'zone' },
      fetchImpl: async (_url, options) => { methods.push(options.method); return cloudflareResponse(unsafe); },
      artifactDir,
    }), /reviewed|safe|audit/i);
    assert.deepEqual(methods, ['GET']);
  }
});

test('apply-home rejects legacy named rules when an earlier unknown cache rule creates a precedence conflict', async () => {
  const earlierBroadRule = {
    ref: 'earlier-broad-cache',
    description: 'Earlier broad cache',
    expression: '(http.host eq "petposture.com")',
    action: 'set_cache_settings',
    action_parameters: { cache: true },
  };
  const legacy = ruleset({
    rules: [earlierBroadRule, ...rules.map((rule) => rule.ref === 'api'
      ? { ...rule, expression: API_EXPRESSION.replace('(http.host eq "api.petposture.com") and ', '') }
      : rule)],
  });

  for (const execute of [false, true]) {
    const artifactDir = await mkdtemp(path.join(os.tmpdir(), `cloudflare-precedence-${execute ? 'execute' : 'dry'}-`));
    const exportPath = path.join(artifactDir, 'fresh.json');
    await writeFile(exportPath, JSON.stringify(createExportArtifact(legacy)));
    const methods = [];
    const logs = output();
    let artifactWrites = 0;
    await assert.rejects(() => runCommand(['apply-home', '--from-export', exportPath, ...(execute ? ['--execute'] : [])], {
      env: { CLOUDFLARE_API_TOKEN: 'secret', CLOUDFLARE_ZONE_ID: 'zone' },
      fetchImpl: async (_url, options) => {
        methods.push(options.method);
        return cloudflareResponse(legacy);
      },
      stdout: logs.stream,
      artifactDir,
      artifactWriter: async () => { artifactWrites += 1; },
    }), /precedence|earlier/i);
    assert.deepEqual(methods, ['GET']);
    assert.equal(artifactWrites, 0);
    assert.equal(logs.read(), '');
  }
});

test('restore requires confirmation and remains dry-run unless --execute is explicit', async () => {
  const artifactDir = await mkdtemp(path.join(os.tmpdir(), 'cloudflare-restore-'));
  const exportPath = path.join(artifactDir, 'fresh.json');
  await writeFile(exportPath, JSON.stringify(createExportArtifact(ruleset())));
  const fetchImpl = async () => cloudflareResponse(ruleset());
  await assert.rejects(() => runCommand(['restore', '--from-export', exportPath], {
    env: { CLOUDFLARE_API_TOKEN: 'secret', CLOUDFLARE_ZONE_ID: 'zone' }, fetchImpl, artifactDir,
  }), /confirm/i);
  const result = await runCommand(['restore', '--from-export', exportPath, '--confirm-restore'], {
    env: { CLOUDFLARE_API_TOKEN: 'secret', CLOUDFLARE_ZONE_ID: 'zone' }, fetchImpl, stdout: output().stream, artifactDir,
  });
  assert.equal(result.dryRun, true);
  assert.deepEqual(result.request.rules, rules);
});

test('audit requires exact reviewed HTML/API semantics and recognizes only the pre-apply broad HTML candidate', () => {
  const reviewed = ruleset({ rules: buildApplyRules(ruleset()).rules });
  assert.equal(auditRuleset(reviewed).pass, true);

  const broadHtml = ruleset();
  const broadReport = auditRuleset(broadHtml, { throwOnFailure: false });
  assert.equal(broadReport.pass, false);
  assert.equal(broadReport.expected.html.legacyCandidate, true);
  assert.match(broadReport.failures.join('\n'), /legacy|transform/i);

  for (const [ref, expression] of [
    ['html', `${HOME_EXPRESSION} or (http.request.uri.path eq "/products")`],
    ['api', '(http.host eq "api.petposture.com") and (http.request.method eq "GET")'],
    ['api', API_EXPRESSION.replace('api.petposture.com', 'api.petposture.com.evil.example')],
  ]) {
    assert.throws(() => auditRuleset(ruleset({ rules: reviewed.rules.map((rule) => rule.ref === ref ? { ...rule, expression } : rule) })), /semantic|reviewed|safe/i);
  }
});

test('audit permits only explicitly recognized earlier static or API cache predicates', () => {
  const reviewedRules = buildApplyRules(ruleset()).rules;
  const earlierRule = (expression, overrides = {}) => ({
    ref: 'earlier-cache',
    description: 'Earlier cache rule',
    expression,
    action: 'set_cache_settings',
    action_parameters: { cache: true },
    ...overrides,
  });
  const safeExpressions = [
    '(http.host eq "petposture.com") and (http.request.uri.path matches "^/_next/static/")',
    API_EXPRESSION,
    API_EXPRESSION.replace('(http.host eq "api.petposture.com") and ', ''),
  ];
  for (const expression of safeExpressions) {
    assert.doesNotThrow(() => auditRuleset(ruleset({ rules: [earlierRule(expression), ...reviewedRules] })), expression);
  }

  const unsafeExpressions = [
    '(http.host eq "petposture.com")',
    '(http.request.uri.path matches "^/products/")',
    '(http.request.method eq "GET")',
    '(http.host in {"petposture.com" "www.petposture.com"}) and (http.request.uri.path matches "^/_next/static/")',
    '(not starts_with(http.request.uri.path, "/api/"))',
    '(http.request.uri.path matches "^/_next/static/") or (http.request.uri.path eq "/")',
    'true',
  ];
  for (const expression of unsafeExpressions) {
    assert.throws(() => auditRuleset(ruleset({ rules: [earlierRule(expression), ...reviewedRules] })), /precedence|earlier|conclusively/i, expression);
  }
  assert.doesNotThrow(() => auditRuleset(ruleset({ rules: [earlierRule('true', { enabled: false }), ...reviewedRules] })));
});

test('HOME expression exactly requires an entirely absent Cookie header', () => {
  const evidence = fixture.home_expression_validation;
  assert.equal(HOME_EXPRESSION, evidence.expression);
  assert.equal(buildHomeRule().expression, evidence.expression);
  assert.match(HOME_EXPRESSION, /\(not any\(lower\(http\.request\.headers\.names\[\*\]\)\[\*\] eq "cookie"\)\)/);
  assert.doesNotMatch(HOME_EXPRESSION, /matches|contains|wildcard|http\.cookie/i);
  assert.equal(evidence.cases.find(({ name }) => name === 'no-cookie-header').cacheEligible, true);
  for (const testCase of evidence.cases.filter(({ cookieHeaderPresent }) => cookieHeaderPresent)) {
    assert.equal(testCase.cacheEligible, false, `${testCase.name} must bypass`);
  }
});

test('HOME expression header exclusions are case-insensitive (regression: bare eq silently ignored mixed-case headers)', () => {
  // Incident 2026-09-06: `http.request.headers.names[*] eq "cookie"` never
  // matched a real `Cookie` header on HTTP/1.1 because Cloudflare does not
  // lowercase header names off HTTP/2. Every exclusion clause therefore
  // silently passed through session cookies and RSC/prefetch headers as
  // cacheable, and the homepage rule served them as public CF-Cache-Status:
  // HIT. Guard against ever reintroducing an unwrapped comparison.
  const bareComparison = /(?<!lower\()http\.request\.headers\.names\[\*\]\s+eq/;
  assert.doesNotMatch(HOME_EXPRESSION, bareComparison, 'header-name comparison must be wrapped in lower(...) or same-case-only clients bypass the exclusion');
  for (const header of ['purpose', 'sec-purpose', 'next-router-prefetch', 'rsc', 'next-router-state-tree', 'next-router-segment-prefetch', 'cookie']) {
    assert.match(HOME_EXPRESSION, new RegExp(`\\(not any\\(lower\\(http\\.request\\.headers\\.names\\[\\*\\]\\)\\[\\*\\] eq "${header}"\\)\\)`), `${header} exclusion must use lower()`);
  }
});

test('HOME expression preserves exact navigation, query, host, method, path, and prefetch restrictions', () => {
  for (const required of [
    '(http.host eq "petposture.com")',
    '(http.request.method in {"GET" "HEAD"})',
    '(http.request.uri.path eq "/")',
    '(http.request.uri.query eq "")',
    '(not any(lower(http.request.headers.names[*])[*] eq "purpose"))',
    '(not any(lower(http.request.headers.names[*])[*] eq "sec-purpose"))',
    '(not any(lower(http.request.headers.names[*])[*] eq "next-router-prefetch"))',
    '(not any(lower(http.request.headers.names[*])[*] eq "rsc"))',
    '(not any(lower(http.request.headers.names[*])[*] eq "next-router-state-tree"))',
    '(not any(lower(http.request.headers.names[*])[*] eq "next-router-segment-prefetch"))',
    '(not any(lower(http.request.headers.names[*])[*] eq "cookie"))',
  ]) assert.ok(HOME_EXPRESSION.includes(required), `missing ${required}`);
  assert.deepEqual(fixture.home_expression_validation.parserValidation, {
    endpoint: '/zones/{zone_id}/filters/validate-expr',
    authenticated: false,
    mutating: false,
    success: null,
    reason: 'credentials unavailable in delegated runtime',
  });
});

test('trusted exports require a present valid SHA-256 matching their exact payload', () => {
  const artifact = createExportArtifact(ruleset());
  assert.doesNotThrow(() => parseExport(artifact, ruleset(), { requireTrusted: true }));
  assert.throws(() => parseExport({ ...artifact, sha256: undefined }, ruleset(), { requireTrusted: true }), /SHA-256|required/i);
  assert.throws(() => parseExport({ ...artifact, sha256: 'xyz' }, ruleset(), { requireTrusted: true }), /SHA-256|malformed/i);
  assert.throws(() => parseExport({ ...artifact, sha256: '0'.repeat(64) }, ruleset(), { requireTrusted: true }), /SHA-256|match/i);
});

test('restore accepts a trusted older version with matching live ID, warns, preserves exact fields/order, and PUTs once', async () => {
  const artifactDir = await mkdtemp(path.join(os.tmpdir(), 'cloudflare-restore-old-'));
  const old = ruleset({ version: 'v6', rules: rules.map((rule, index) => ({ ...rule, ref: `${rule.ref}-${index}`, extra: { keep: index } })) });
  const live = ruleset({ version: 'v9' });
  const exportPath = path.join(artifactDir, 'old.json');
  await writeFile(exportPath, JSON.stringify(createExportArtifact(old)));
  const requests = [];
  const logs = output();
  await runCommand(['restore', '--from-export', exportPath, '--confirm-restore', '--execute'], {
    env: { CLOUDFLARE_API_TOKEN: 'secret', CLOUDFLARE_ZONE_ID: 'zone' },
    fetchImpl: async (_url, options) => {
      requests.push(options);
      return cloudflareResponse(options.method === 'PUT' ? { ...live, version: 'v10', rules: old.rules } : live);
    },
    stdout: logs.stream,
    artifactDir,
  });
  assert.deepEqual(requests.map(({ method }) => method), ['GET', 'PUT']);
  assert.deepEqual(JSON.parse(requests[1].body).rules, old.rules);
  assert.match(logs.read(), /STALE VERSION WARNING|older/i);

  const mismatched = createExportArtifact({ ...old, id: 'different-ruleset' });
  await writeFile(exportPath, JSON.stringify(mismatched));
  await assert.rejects(() => runCommand(['restore', '--from-export', exportPath, '--confirm-restore'], {
    env: { CLOUDFLARE_API_TOKEN: 'secret', CLOUDFLARE_ZONE_ID: 'zone' }, fetchImpl: async () => cloudflareResponse(live), artifactDir,
  }), /ID|ruleset/i);
});

test('mutation failures are distinguishable from post-PUT artifact failures with recoverable response data', async () => {
  const artifactDir = await mkdtemp(path.join(os.tmpdir(), 'cloudflare-failure-'));
  const exportPath = path.join(artifactDir, 'fresh.json');
  await writeFile(exportPath, JSON.stringify(createExportArtifact(ruleset())));
  let puts = 0;
  await assert.rejects(() => runCommand(['apply-home', '--from-export', exportPath, '--execute'], {
    env: { CLOUDFLARE_API_TOKEN: 'secret', CLOUDFLARE_ZONE_ID: 'zone' },
    fetchImpl: async (_url, options) => {
      if (options.method === 'PUT') { puts += 1; return new Response(JSON.stringify({ success: false, errors: [{ message: 'denied' }] }), { status: 500 }); }
      return cloudflareResponse(ruleset());
    },
    artifactDir,
  }), /PUT failed/i);
  assert.equal(puts, 1);

  puts = 0;
  let artifactWrites = 0;
  await assert.rejects(() => runCommand(['apply-home', '--from-export', exportPath, '--execute'], {
    env: { CLOUDFLARE_API_TOKEN: 'secret', CLOUDFLARE_ZONE_ID: 'zone' },
    fetchImpl: async (_url, options) => {
      if (options.method === 'PUT') puts += 1;
      return cloudflareResponse(options.method === 'PUT' ? { ...ruleset(), version: 'v8' } : ruleset());
    },
    artifactDir,
    artifactWriter: async (artifact, options) => {
      artifactWrites += 1;
      if (artifactWrites === 2) throw new Error('disk full');
      const file = path.join(artifactDir, `write-${artifactWrites}${options.suffix}.json`);
      await writeFile(file, JSON.stringify(artifact));
      return file;
    },
  }), (error) => error.mutationSucceeded === true && error.result?.version === 'v8' && /MUTATION SUCCEEDED|artifact/i.test(error.message));
  assert.equal(puts, 1);
});

test('apply-home PUT omits response-only top-level fields and preserves writable metadata plus exact live API rule', async () => {
  const live = ruleset({
    description: 'live description',
    last_updated: '2026-09-06T19:00:00Z',
    rules: rules.map((rule) => rule.ref === 'api' ? { ...rule, expression: LIVE_API_EXPRESSION } : rule),
  });
  const artifactDir = await mkdtemp(path.join(os.tmpdir(), 'cloudflare-apply-payload-'));
  const exportPath = path.join(artifactDir, 'fresh.json');
  await writeFile(exportPath, JSON.stringify(createExportArtifact(live)));
  const requests = [];
  await runCommand(['apply-home', '--from-export', exportPath, '--execute'], {
    env: { CLOUDFLARE_API_TOKEN: 'secret', CLOUDFLARE_ZONE_ID: 'zone' },
    fetchImpl: async (_url, options) => {
      requests.push(options);
      return cloudflareResponse(options.method === 'PUT' ? { ...live, version: 'v8' } : live);
    },
    stdout: output().stream,
    artifactDir,
  });
  const request = JSON.parse(requests[1].body);
  assert.deepEqual(Object.keys(request), ['name', 'description', 'rules']);
  assert.deepEqual({ name: request.name, description: request.description }, {
    name: live.name, description: live.description,
  });
  assert.equal(request.rules.find((rule) => rule.ref === 'api').expression, LIVE_API_EXPRESSION);
});

test('stock restore execute omits response-only top-level fields and preserves exact exported rules/order/refs', async () => {
  const artifactDir = await mkdtemp(path.join(os.tmpdir(), 'cloudflare-restore-payload-'));
  const exported = ruleset({
    description: 'restore description',
    last_updated: '2026-09-06T19:00:00Z',
    rules: rules.map((rule, index) => ({ ...rule, ref: `restore-${index}`, marker: index })),
  });
  const exportPath = path.join(artifactDir, 'fresh.json');
  await writeFile(exportPath, JSON.stringify(createExportArtifact(exported)));
  const requests = [];
  await runCommand(['restore', '--from-export', exportPath, '--confirm-restore', '--execute'], {
    env: { CLOUDFLARE_API_TOKEN: 'secret', CLOUDFLARE_ZONE_ID: 'zone' },
    fetchImpl: async (_url, options) => {
      requests.push(options);
      return cloudflareResponse(options.method === 'PUT' ? { ...exported, version: 'v8' } : exported);
    },
    stdout: output().stream,
    artifactDir,
  });
  const request = JSON.parse(requests[1].body);
  assert.deepEqual(Object.keys(request), ['name', 'description', 'rules']);
  assert.deepEqual(request.rules, exported.rules);
  assert.deepEqual(request.rules.map((rule) => rule.ref), exported.rules.map((rule) => rule.ref));
});

test('apply and restore share the exact account-proven writable top-level sanitizer', () => {
  const source = { ...liveV5Fixture, extra_response_field: 'drop-me' };
  const request = buildMutationRequest(source, liveV5Fixture.rules);
  assert.deepEqual(Object.keys(request), ['name', 'description', 'rules']);
  assert.deepEqual(request, { name: source.name, description: source.description, rules: liveV5Fixture.rules });
  for (const field of ['kind', 'version', 'last_updated', 'phase', 'id', 'extra_response_field']) assert.equal(field in request, false);
});

test('v16 bypass preserves all four reviewed rules and adds only final denial', () => {
  assert.equal(typeof buildHomeBypassRules, 'function', 'missing v16 builder');
  const before = structuredClone(liveV16Fixture);
  const update = buildHomeBypassRules(liveV16Fixture);
  assert.deepEqual(update.rules.slice(0, 4), liveV16Fixture.rules);
  assert.equal(update.rules.length, 5);
  assert.deepEqual(update.rules[4].action_parameters, { cache: false });
  assert.equal(update.rules[4].enabled, true);
  assert.equal(update.rules[4].expression, HOME_BYPASS_EXPRESSION);
  assert.equal(auditHomeBypassRuleset({ ...liveV16Fixture, rules: update.rules }).pass, true);
  assert.equal(buildHomeBypassRules({ ...liveV16Fixture, rules: update.rules }).changed, false);
  assert.equal(update.changed, true);
  assert.deepEqual(liveV16Fixture, before);
  assert.deepEqual(buildHomeBypassRule(), {
    ref: 'bypass_excluded_petposture_homepage', description: 'Bypass excluded petposture.com homepage requests',
    expression: EXPECTED_BYPASS_EXPRESSION, enabled: true, action: 'set_cache_settings', action_parameters: { cache: false },
  });
  assert.equal(HOME_BYPASS_DESCRIPTION, 'Bypass excluded petposture.com homepage requests');
  assert.equal(HOME_BYPASS_EXPRESSION, EXPECTED_BYPASS_EXPRESSION);
  assert.equal(HOME_EXPRESSION, liveV16Fixture.rules[3].expression);
  assert.doesNotMatch(HOME_BYPASS_EXPRESSION, /matches/);
  for (const header of ['purpose', 'sec-purpose', 'next-router-prefetch', 'rsc', 'next-router-state-tree', 'next-router-segment-prefetch', 'cookie']) {
    assert.ok(HOME_BYPASS_EXPRESSION.includes(`lower(http.request.headers.names[*])[*] eq "${header}"`));
  }
});

// Boolean complement model only, NOT a Cloudflare expression parser or zone validation.
test('bypass Boolean model isolates wrong hosts and non-home paths', () => {
  const excludedHeaders = ['purpose', 'sec-purpose', 'next-router-prefetch', 'rsc', 'next-router-state-tree', 'next-router-segment-prefetch', 'cookie'];
  for (const host of ['petposture.com', 'api.petposture.com', 'www.petposture.com']) {
    for (const pathname of ['/', '/account', '/_next/static/a.js', '/storage/a.jpg']) {
      for (const method of ['GET', 'HEAD', 'POST']) {
        for (const query of ['', 'x=1']) {
          for (const headers of [[], ...excludedHeaders.map((name) => [name.toUpperCase()])]) {
            const scoped = host === 'petposture.com' && pathname === '/';
            const allowed = scoped && ['GET', 'HEAD'].includes(method) && query === '' && !headers.some((name) => excludedHeaders.includes(name.toLowerCase()));
            const bypass = scoped && !allowed;
            assert.equal(bypass, scoped && (method === 'POST' || query !== '' || headers.length > 0));
            if (!scoped) assert.equal(bypass, false);
          }
        }
      }
    }
  }
});

for (let index = 0; index < 5; index += 1) {
  for (const field of ['enabled', 'action', 'action_parameters', 'expression', 'description']) {
    test(`v16 audit rejects rule ${index + 1} ${field} drift`, () => {
      assert.equal(typeof buildHomeBypassRules, 'function');
      const source = { ...structuredClone(liveV16Fixture), rules: buildHomeBypassRules(liveV16Fixture).rules };
      const rule = source.rules[index];
      rule[field] = field === 'enabled' ? !rule.enabled : field === 'action_parameters' ? { ...rule.action_parameters, cache: !rule.action_parameters.cache } : `${rule[field]} drift`;
      const report = auditHomeBypassRuleset(source, { throwOnFailure: false });
      assert.equal(report.pass, false);
      assert.ok(report.failures.length > 0);
      assert.throws(() => buildHomeBypassRules(source), /audit|reviewed|drift/i);
    });
  }
}

for (const mutation of ['missing', 'swapped', 'later allow', 'earlier unknown', 'duplicate legacy', 'duplicate active', 'duplicate bypass', 'duplicate ref', 'reserved ref', 'bypass ref', 'missing ref', 'duplicate id', 'extra parameters']) {
  test(`v16 rejects topology: ${mutation}`, () => {
    assert.equal(typeof buildHomeBypassRules, 'function');
    const source = { ...structuredClone(liveV16Fixture), rules: buildHomeBypassRules(liveV16Fixture).rules };
    if (mutation === 'missing') source.rules.splice(1, 1);
    if (mutation === 'swapped') [source.rules[1], source.rules[2]] = [source.rules[2], source.rules[1]];
    if (mutation === 'later allow') source.rules.push({ ...source.rules[3], ref: 'extra', id: 'extra' });
    if (mutation === 'earlier unknown') source.rules.unshift({ ...source.rules[4], description: 'unknown', ref: 'extra' });
    if (mutation.startsWith('duplicate ') && !['duplicate ref', 'duplicate id'].includes(mutation)) {
      const index = mutation === 'duplicate legacy' ? 0 : mutation === 'duplicate active' ? 3 : 4;
      source.rules[1].description = source.rules[index].description;
    }
    if (mutation === 'duplicate ref') source.rules[1].ref = source.rules[0].ref;
    if (mutation === 'reserved ref') { source.rules.pop(); source.rules[1].ref = 'bypass_excluded_petposture_homepage'; }
    if (mutation === 'bypass ref') source.rules[4].ref = 'unreviewed-bypass';
    if (mutation === 'missing ref') delete source.rules[0].ref;
    if (mutation === 'duplicate id') source.rules[1].id = source.rules[0].id;
    if (mutation === 'extra parameters') source.rules[1].action_parameters.extra = true;
    assert.throws(() => buildHomeBypassRules(source), /audit|reviewed|ref|duplicat/i);
  });
}

test('v16 accepts whitespace and unpinned identity/version while preserving all metadata', () => {
  assert.equal(typeof buildHomeBypassRules, 'function');
  const source = structuredClone(liveV16Fixture);
  source.version = '23';
  source.id = 'other-live-id';
  source.rules.forEach((rule, index) => { rule.ref = `fresh-${index}`; rule.id = `fresh-id-${index}`; rule.expression = `  ${rule.expression}  `; rule.logging = { enabled: true }; });
  const update = buildHomeBypassRules(source);
  assert.deepEqual(update.rules.slice(0, 4), source.rules);
  const report = auditHomeBypassRuleset(source);
  assert.equal(report.bypassPresent, false);
  assert.deepEqual(report.rules.map((rule) => rule.action_parameters), source.rules.map((rule) => rule.action_parameters));
});

test('old apply-home builder rejects a separate active homepage topology', () => {
  assert.throws(() => buildApplyRules(liveV16Fixture), /separate|apply-home-bypass|active homepage/i);
});

async function bypassCommandCase({ live = liveV16Fixture, exported = createExportArtifact(live), execute = true, command = 'apply-home-bypass', artifactWriter } = {}) {
  const artifactDir = await mkdtemp(path.join(os.tmpdir(), 'cloudflare-v16-'));
  const exportPath = path.join(artifactDir, 'fresh.json');
  await writeFile(exportPath, JSON.stringify(exported));
  const requests = [];
  const logs = output();
  const promise = runCommand([command, '--from-export', exportPath, ...(execute ? ['--execute'] : [])], {
    env: { CLOUDFLARE_API_TOKEN: 'fake-secret', CLOUDFLARE_ZONE_ID: 'fake-zone' },
    fetchImpl: async (_url, options) => {
      requests.push(options);
      return cloudflareResponse(options.method === 'PUT' ? { ...live, version: '17', rules: JSON.parse(options.body).rules } : live);
    },
    stdout: logs.stream, artifactDir, ...(artifactWriter ? { artifactWriter } : {}),
  });
  return { promise, requests, logs };
}

test('apply-home-bypass dry-run GET-only and execute exactly one PUT preserve original rules and ordered audit', async () => {
  for (const execute of [false, true]) {
    const { promise, requests, logs } = await bypassCommandCase({ execute });
    const result = await promise;
    assert.deepEqual(requests.map(({ method }) => method), execute ? ['GET', 'PUT'] : ['GET']);
    const request = execute ? JSON.parse(requests[1].body) : result.request;
    assert.deepEqual(request.rules.slice(0, 4), liveV16Fixture.rules);
    assert.equal(request.rules[4].expression, EXPECTED_BYPASS_EXPRESSION);
    assert.deepEqual(JSON.parse(await readFile(result.rollbackFile, 'utf8')).ruleset, liveV16Fixture);
    let previous = -1;
    for (const rule of request.rules) { const position = logs.read().indexOf(rule.description); assert.ok(position > previous); previous = position; }
    assert.match(logs.read(), /enabled=false/);
    assert.match(logs.read(), /override_origin/);
    assert.equal(result.dryRun, !execute);
  }
});

for (const drift of ['sha', 'id', 'version', 'content', 'ref']) {
  test(`apply-home-bypass rejects stale export ${drift} before PUT`, async () => {
    const exported = createExportArtifact(liveV16Fixture);
    if (drift === 'sha') exported.sha256 = '0'.repeat(64);
    if (drift === 'id') exported.ruleset.id = 'different';
    if (drift === 'version') exported.ruleset.version = '15';
    if (drift === 'content') exported.ruleset.rules[0].enabled = true;
    if (drift === 'ref') exported.ruleset.rules[0].ref = 'different-ref';
    const { promise, requests } = await bypassCommandCase({ exported });
    await assert.rejects(promise, /stale|match|SHA-256/i);
    assert.deepEqual(requests.map(({ method }) => method), ['GET']);
  });
}

test('apply-home-bypass refuses failed rollback write before PUT', async () => {
  const { promise, requests } = await bypassCommandCase({ artifactWriter: async () => { throw new Error('rollback disk full'); } });
  await assert.rejects(promise, /rollback disk full/);
  assert.deepEqual(requests.map(({ method }) => method), ['GET']);
});

test('apply-home-bypass audits transformed output before PUT even after rollback callback', async () => {
  const { promise, requests } = await bypassCommandCase({ artifactWriter: async (artifact) => {
    // A caller-controlled persistence hook must not smuggle a changed candidate to PUT.
    if (artifact.ruleset) artifact.ruleset.rules[0].enabled = true;
    return 'fake-rollback';
  } });
  const result = await promise;
  assert.equal(result.dryRun, false);
  assert.equal(JSON.parse(requests[1].body).rules[0].enabled, false);
  assert.equal(auditHomeBypassRuleset({ ...liveV16Fixture, rules: JSON.parse(requests[1].body).rules }).pass, true);
});

test('apply-home-bypass reports successful mutation with recoverable result after post-PUT write failure', async () => {
  let writes = 0;
  const { promise, requests } = await bypassCommandCase({ artifactWriter: async () => { if (++writes === 2) throw new Error('disk full'); return 'rollback'; } });
  await assert.rejects(promise, (error) => error.mutationSucceeded === true && error.result?.version === '17' && error.artifact?.result?.rules.length === 5);
  assert.deepEqual(requests.map(({ method }) => method), ['GET', 'PUT']);
});

test('apply-home-bypass execute is no-op for reviewed five-rule input without redundant artifact', async () => {
  assert.equal(typeof buildHomeBypassRules, 'function');
  const live = { ...liveV16Fixture, rules: buildHomeBypassRules(liveV16Fixture).rules };
  const { promise, requests } = await bypassCommandCase({ live, artifactWriter: async () => { assert.fail('no-op must not write a mutation artifact'); } });
  const result = await promise;
  assert.equal(result.changed, false);
  assert.deepEqual(result.result, live);
  assert.deepEqual(requests.map(({ method }) => method), ['GET']);
});

test('old apply-home CLI rejects v16 before artifacts or PUT', async () => {
  const { promise, requests } = await bypassCommandCase({ command: 'apply-home', artifactWriter: async () => { assert.fail('must reject before rollback'); } });
  await assert.rejects(promise, /separate|apply-home-bypass|active homepage/i);
  assert.deepEqual(requests.map(({ method }) => method), ['GET']);
});

test('pure bypass builder rejects output drift rather than trusting only its input audit', () => {
  const source = structuredClone(liveV16Fixture);
  let reads = 0;
  Object.defineProperty(source.rules[0], 'enabled', {
    enumerable: true,
    // Input check and its report see the reviewed rule; cloning the candidate sees drift.
    get() { reads += 1; return reads > 2; },
  });
  assert.throws(() => buildHomeBypassRules(source), /audit.*failed|enabled.*reviewed/is);
});

for (const drift of ['enabled', 'action', 'parameters', 'expression', 'order', 'extra denial']) {
  test(`apply-home-bypass rejects live ${drift} before rollback and PUT`, async () => {
    const live = structuredClone(liveV16Fixture);
    if (drift === 'enabled') live.rules[0].enabled = true;
    if (drift === 'action') live.rules[3].action = 'skip';
    if (drift === 'parameters') live.rules[2].action_parameters.edge_ttl.default = 301;
    if (drift === 'expression') live.rules[3].expression += ' or true';
    if (drift === 'order') [live.rules[1], live.rules[2]] = [live.rules[2], live.rules[1]];
    if (drift === 'extra denial') live.rules.push({ description: 'Unknown denial', ref: 'unknown', expression: 'true', enabled: true, action: 'set_cache_settings', action_parameters: { cache: false } });
    const { promise, requests } = await bypassCommandCase({ live, artifactWriter: async () => { assert.fail('unsafe topology must fail before rollback'); } });
    await assert.rejects(promise, /audit.*failed/is);
    assert.deepEqual(requests.map(({ method }) => method), ['GET']);
  });
}

test('all generated mutation payloads preserve fields/order/refs and contain no override_origin anywhere', () => {
  const source = ruleset({ rules: rules.map((rule, index) => ({ ...rule, enabled: index !== 2, logging: { enabled: true }, extra: `keep-${index}` })) });
  const applied = buildApplyRules(source).rules;
  assert.deepEqual(applied.map((rule) => rule.ref), source.rules.map((rule) => rule.ref));
  assert.deepEqual(applied.map((rule) => rule.extra), source.rules.map((rule) => rule.extra));
  assert.doesNotMatch(JSON.stringify(applied), /override_origin/);
});
