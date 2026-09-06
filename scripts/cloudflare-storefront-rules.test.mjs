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
  HOME_EXPRESSION,
  API_EXPRESSION,
} from './cloudflare-storefront-rules.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/cloudflare-cache-ruleset.json', import.meta.url), 'utf8'));
const rules = fixture.rules;

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

test('audit rejects an earlier enabled rule capable of caching homepage traffic', () => {
  const reviewedRules = buildApplyRules(ruleset()).rules;
  const conflict = {
    ref: 'earlier-conflict',
    description: 'Earlier broad cache',
    expression: '(http.host eq "petposture.com")',
    action: 'set_cache_settings',
    action_parameters: { cache: true },
  };
  assert.throws(() => auditRuleset(ruleset({ rules: [conflict, ...reviewedRules] })), /precedence|earlier/i);
  assert.doesNotThrow(() => auditRuleset(ruleset({ rules: [{ ...conflict, enabled: false }, ...reviewedRules] })));
});

test('HOME expression has exact reviewed exclusions and cookie-name boundaries', () => {
  assert.equal(buildHomeRule().expression, HOME_EXPRESSION);
  for (const required of [
    'not any(http.request.headers.names[*] eq "purpose")',
    'not any(http.request.headers.names[*] eq "sec-purpose")',
    'not any(http.request.headers.names[*] eq "next-router-prefetch")',
    'not any(http.request.headers.names[*] eq "rsc")',
    'not any(http.request.headers.names[*] eq "next-router-state-tree")',
    'not any(http.request.headers.names[*] eq "next-router-segment-prefetch")',
    'not http.cookie matches "(?i)(^|;\\s*)petposture-session="',
    'not http.cookie matches "(?i)(^|;\\s*)XSRF-TOKEN="',
  ]) assert.ok(HOME_EXPRESSION.includes(required), `missing ${required}`);
  assert.doesNotMatch(HOME_EXPRESSION, /contains "petposture-session="|contains "XSRF-TOKEN="/);
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

test('all generated mutation payloads preserve fields/order/refs and contain no override_origin anywhere', () => {
  const source = ruleset({ rules: rules.map((rule, index) => ({ ...rule, enabled: index !== 2, logging: { enabled: true }, extra: `keep-${index}` })) });
  const applied = buildApplyRules(source).rules;
  assert.deepEqual(applied.map((rule) => rule.ref), source.rules.map((rule) => rule.ref));
  assert.deepEqual(applied.map((rule) => rule.extra), source.rules.map((rule) => rule.extra));
  assert.doesNotMatch(JSON.stringify(applied), /override_origin/);
});
