import test from 'node:test';
import assert from 'node:assert/strict';
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
} from './cloudflare-storefront-rules.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/cloudflare-cache-ruleset.json', import.meta.url), 'utf8'));
const rules = fixture.rules;

function ruleset(overrides = {}) {
  return { ...structuredClone(fixture), ...overrides };
}

test('auditRuleset identifies exact rules, host scope, and evaluation order', () => {
  const report = auditRuleset(ruleset());
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
  assert.throws(() => auditRuleset(ruleset({ rules: rules.map((rule) => rule.ref === 'api' ? { ...rule, expression: '(http.request.method eq "GET")' } : rule) })), /hostname|scop/i);
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

test('apply-home --execute performs one atomic PUT and saves rollback plus post-change response', async () => {
  const artifactDir = await mkdtemp(path.join(os.tmpdir(), 'cloudflare-execute-'));
  const exportPath = path.join(artifactDir, 'fresh.json');
  await writeFile(exportPath, JSON.stringify(createExportArtifact(ruleset())));
  const requests = [];
  const changed = { ...ruleset(), version: 'v8', rules: buildApplyRules(ruleset()).rules };
  const result = await runCommand(['apply-home', '--from-export', exportPath, '--execute'], {
    env: { CLOUDFLARE_API_TOKEN: 'secret', CLOUDFLARE_ZONE_ID: 'zone' },
    fetchImpl: async (_url, options) => {
      requests.push(options);
      return cloudflareResponse(options.method === 'PUT' ? changed : ruleset());
    },
    stdout: output().stream,
    artifactDir,
  });
  assert.deepEqual(requests.map(({ method }) => method), ['GET', 'PUT']);
  assert.equal(JSON.parse(requests[1].body).rules.length, rules.length);
  assert.deepEqual(JSON.parse(await readFile(result.rollbackFile, 'utf8')).ruleset, ruleset());
  assert.equal(JSON.parse(await readFile(result.file, 'utf8')).result.version, 'v8');
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
