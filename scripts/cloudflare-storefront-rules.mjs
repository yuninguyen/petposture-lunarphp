import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const HTML_RULE_DESCRIPTION = 'Cache HTML pages';
export const API_RULE_DESCRIPTION = 'Cache safe public catalog/content API GET endpoints (5 min edge TTL)';
export const HOME_RULE_DESCRIPTION = 'Cache anonymous petposture.com homepage';

const PHASE = 'http_request_cache_settings';
const ARTIFACT_SCHEMA = 'petposture-cloudflare-cache-ruleset-export-v1';
const API_HOST_CONDITION = '(http.host eq "api.petposture.com")';
const HOME_EXPRESSION = [
  '(http.host eq "petposture.com")',
  '(http.request.method in {"GET" "HEAD"})',
  '(http.request.uri.path eq "/")',
  '(http.request.uri.query eq "")',
  '(not http.request.headers["purpose"][*] contains "prefetch")',
  '(not http.request.headers["sec-purpose"][*] contains "prefetch")',
  '(not any(http.request.headers["next-router-prefetch"][*] eq "1"))',
  '(not any(http.request.headers["rsc"][*] eq "1"))',
  '(not http.cookie contains "petposture-session=")',
  '(not http.cookie contains "XSRF-TOKEN=")',
  '(not http.cookie contains "laravel_session=")',
].join(' and ');

function clone(value) {
  return structuredClone(value);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : stableJson(value)).digest('hex');
}

function hostScope(expression, expectedHost) {
  const escaped = expectedHost.replaceAll('.', '\\.');
  return new RegExp(`http\\.host\\s+eq\\s+"${escaped}"`).test(expression ?? '');
}

function findExact(rules, description) {
  return rules.filter((rule) => rule.description === description);
}

function assertRulesetShape(ruleset) {
  if (!ruleset || typeof ruleset !== 'object' || !ruleset.id || ruleset.version === undefined || !Array.isArray(ruleset.rules)) {
    throw new Error('Cloudflare response is not a complete ruleset with id, version, and rules');
  }
}

export function auditRuleset(ruleset, { throwOnFailure = true } = {}) {
  assertRulesetShape(ruleset);
  const htmlRules = findExact(ruleset.rules, HTML_RULE_DESCRIPTION);
  const apiRules = findExact(ruleset.rules, API_RULE_DESCRIPTION);
  const failures = [];

  if (htmlRules.length === 0) failures.push(`${HTML_RULE_DESCRIPTION} is missing`);
  if (htmlRules.length > 1) failures.push(`${HTML_RULE_DESCRIPTION} is duplicated`);
  if (apiRules.length === 0) failures.push(`${API_RULE_DESCRIPTION} is missing`);
  if (apiRules.length > 1) failures.push(`${API_RULE_DESCRIPTION} is duplicated`);

  const htmlScoped = htmlRules.length === 1 && hostScope(htmlRules[0].expression, 'petposture.com');
  const apiScoped = apiRules.length === 1 && hostScope(apiRules[0].expression, 'api.petposture.com');
  if (htmlRules.length === 1 && !htmlScoped) failures.push(`${HTML_RULE_DESCRIPTION} has no explicit petposture.com hostname scope`);
  if (apiRules.length === 1 && !apiScoped) failures.push(`${API_RULE_DESCRIPTION} has no explicit api.petposture.com hostname scope`);

  const report = {
    pass: failures.length === 0,
    failures,
    expected: {
      html: { count: htmlRules.length, hostnameScoped: htmlScoped, expression: htmlRules[0]?.expression ?? null },
      api: { count: apiRules.length, hostnameScoped: apiScoped, expression: apiRules[0]?.expression ?? null },
    },
    rules: ruleset.rules.map((rule, index) => ({
      order: index + 1,
      description: rule.description ?? '(unnamed)',
      enabled: rule.enabled !== false,
      expression: rule.expression ?? '',
    })),
  };

  if (!report.pass && throwOnFailure) throw new Error(`Ruleset audit failed closed:\n- ${failures.join('\n- ')}`);
  return report;
}

export function buildHomeRule() {
  return {
    ref: 'cache_anonymous_petposture_homepage',
    description: HOME_RULE_DESCRIPTION,
    expression: HOME_EXPRESSION,
    action: 'set_cache_settings',
    action_parameters: {
      cache: true,
      browser_ttl: { mode: 'respect_origin' },
      edge_ttl: { mode: 'respect_origin' },
    },
  };
}

function replaceBroadHtmlRule(rule) {
  const home = buildHomeRule();
  return {
    ...clone(rule),
    expression: home.expression,
    action: home.action,
    action_parameters: home.action_parameters,
  };
}

function scopeApiRule(rule) {
  if (hostScope(rule.expression, 'api.petposture.com')) return clone(rule);
  return { ...clone(rule), expression: `${API_HOST_CONDITION} and (${rule.expression})` };
}

export function buildApplyRules(ruleset) {
  assertRulesetShape(ruleset);
  const htmlRules = findExact(ruleset.rules, HTML_RULE_DESCRIPTION);
  const apiRules = findExact(ruleset.rules, API_RULE_DESCRIPTION);
  if (htmlRules.length !== 1 || apiRules.length !== 1) auditRuleset(ruleset);

  const rules = ruleset.rules.map((rule) => {
    if (rule.description === HTML_RULE_DESCRIPTION) return replaceBroadHtmlRule(rule);
    if (rule.description === API_RULE_DESCRIPTION) return scopeApiRule(rule);
    return clone(rule);
  });
  return { rules, changed: stableJson(rules) !== stableJson(ruleset.rules) };
}

export function createExportArtifact(ruleset, exportedAt = new Date().toISOString()) {
  assertRulesetShape(ruleset);
  return {
    schema: ARTIFACT_SCHEMA,
    exportedAt,
    source: 'live-cloudflare-api',
    ruleset: clone(ruleset),
    sha256: hash(ruleset),
  };
}

export function parseExport(value, liveRuleset, { requireTrusted = false } = {}) {
  const artifact = value?.schema === ARTIFACT_SCHEMA ? value : null;
  if (requireTrusted && (!artifact || artifact.source !== 'live-cloudflare-api' || !artifact.exportedAt)) {
    throw new Error('Refusing untrusted or historical backup: use a fresh export created by this tool');
  }
  const exported = artifact?.ruleset ?? value;
  assertRulesetShape(exported);
  assertRulesetShape(liveRuleset);
  if (String(exported.id) !== String(liveRuleset.id) || String(exported.version) !== String(liveRuleset.version)) {
    throw new Error('Export is stale: ruleset ID/version does not match the just-read live ruleset');
  }
  if (hash(exported) !== hash(liveRuleset)) {
    throw new Error('Export ruleset does not exactly match the just-read live ruleset');
  }
  if (artifact?.sha256 && artifact.sha256 !== hash(exported)) throw new Error('Export SHA-256 does not match its ruleset payload');
  return clone(exported);
}

export function redactSecrets(value, ...secrets) {
  let redacted = String(value);
  for (const secret of secrets.filter(Boolean)) redacted = redacted.replaceAll(String(secret), '[REDACTED]');
  redacted = redacted.replace(/Bearer\s+[^"'\s]+/gi, 'Bearer [REDACTED]');
  return redacted;
}

function timestampForPath(date = new Date()) {
  return date.toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

async function saveArtifact(artifact, { artifactDir = path.join('artifacts', 'cloudflare'), suffix = '' } = {}) {
  await mkdir(artifactDir, { recursive: true });
  const ruleset = artifact.ruleset ?? artifact.result ?? artifact;
  const version = ruleset.version ?? 'unknown';
  const file = path.join(artifactDir, `${timestampForPath()}-cache-ruleset-v${version}${suffix}.json`);
  await writeFile(file, `${JSON.stringify(artifact, null, 2)}\n`, { flag: 'wx' });
  return file;
}

function apiUrl(zoneId) {
  return `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/rulesets/phases/${PHASE}/entrypoint`;
}

async function cloudflareRequest({ method = 'GET', token, zoneId, body, fetchImpl = fetch }) {
  const response = await fetchImpl(apiUrl(zoneId), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { payload = { success: false, errors: [{ message: text }] }; }
  if (!response.ok || payload.success === false) {
    throw new Error(`Cloudflare ${method} failed (${response.status}): ${redactSecrets(JSON.stringify(payload), token)}`);
  }
  const result = payload.result ?? payload;
  assertRulesetShape(result);
  return result;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { execute: false, confirmRestore: false };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === '--execute') options.execute = true;
    else if (argument === '--confirm-restore') options.confirmRestore = true;
    else if (argument === '--from-export') options.fromExport = rest[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return { command, options };
}

function requireEnvironment(env) {
  const token = env.CLOUDFLARE_API_TOKEN;
  const zoneId = env.CLOUDFLARE_ZONE_ID;
  if (!token || !zoneId) throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID are required environment variables');
  return { token, zoneId };
}

function printAudit(report, stdout) {
  for (const rule of report.rules) stdout.write(`${rule.order}. ${rule.description}\n   ${rule.expression}\n`);
  stdout.write(`${HTML_RULE_DESCRIPTION}: hostname-scoped=${report.expected.html.hostnameScoped}\n${report.expected.html.expression}\n`);
  stdout.write(`${API_RULE_DESCRIPTION}: hostname-scoped=${report.expected.api.hostnameScoped}\n${report.expected.api.expression}\n`);
}

export async function runCommand(argv, {
  env = process.env,
  fetchImpl = fetch,
  stdout = process.stdout,
  artifactDir = path.join('artifacts', 'cloudflare'),
} = {}) {
  const { command, options } = parseArgs(argv);
  if (!['export', 'audit', 'apply-home', 'restore'].includes(command)) {
    throw new Error('Usage: cloudflare-storefront-rules.mjs export|audit|apply-home|restore [--from-export path] [--execute] [--confirm-restore]');
  }
  const credentials = requireEnvironment(env);
  const live = await cloudflareRequest({ ...credentials, fetchImpl });

  if (command === 'export') {
    const artifact = createExportArtifact(live);
    const file = await saveArtifact(artifact, { artifactDir });
    stdout.write(`Exported ${file}\nSHA-256 ${artifact.sha256}\nRuleset ${live.id} version ${live.version}\n`);
    return { command, file, artifact };
  }

  if (command === 'audit') {
    const report = auditRuleset(live);
    printAudit(report, stdout);
    return { command, report };
  }

  if (!options.fromExport) throw new Error(`${command} requires --from-export <path>`);
  const supplied = JSON.parse(await readFile(options.fromExport, 'utf8'));

  if (command === 'apply-home') {
    parseExport(supplied, live, { requireTrusted: true });
    const audit = auditRuleset(live, { throwOnFailure: false });
    const expectedCountSafe = audit.expected.html.count === 1 && audit.expected.api.count === 1;
    if (!expectedCountSafe) auditRuleset(live);
    const rollbackArtifact = createExportArtifact(live);
    const rollbackFile = await saveArtifact(rollbackArtifact, { artifactDir, suffix: '-pre-apply-rollback' });
    const update = buildApplyRules(live);
    const request = { name: live.name, description: live.description, kind: live.kind, phase: live.phase, rules: update.rules };
    if (!options.execute) {
      stdout.write(`DRY RUN: no Cloudflare mutation performed\nRollback export ${rollbackFile}\nWould atomically PUT ${update.rules.length} rules\n`);
      return { command, dryRun: true, rollbackFile, request };
    }
    const result = await cloudflareRequest({ method: 'PUT', ...credentials, fetchImpl, body: request });
    const artifact = { schema: 'petposture-cloudflare-cache-ruleset-apply-v1', appliedAt: new Date().toISOString(), rollbackFile, request, result };
    const file = await saveArtifact(artifact, { artifactDir, suffix: '-post-apply' });
    stdout.write(`Applied atomically: ruleset ${result.id} version ${result.version}\nRollback export ${rollbackFile}\nPost-change artifact ${file}\nPurge is required before verification.\n`);
    return { command, dryRun: false, rollbackFile, file, result };
  }

  if (!options.confirmRestore) throw new Error('restore requires --confirm-restore');
  const exported = parseExport(supplied, supplied?.ruleset ?? supplied, { requireTrusted: true });
  const request = { name: exported.name, description: exported.description, kind: exported.kind, phase: exported.phase, rules: clone(exported.rules) };
  if (!options.execute) {
    stdout.write(`DRY RUN: no Cloudflare mutation performed\nWould restore ${exported.rules.length} exact exported rules from ${options.fromExport}\n`);
    return { command, dryRun: true, request };
  }
  const result = await cloudflareRequest({ method: 'PUT', ...credentials, fetchImpl, body: request });
  const artifact = { schema: 'petposture-cloudflare-cache-ruleset-restore-v1', restoredAt: new Date().toISOString(), sourceExport: options.fromExport, result };
  const file = await saveArtifact(artifact, { artifactDir, suffix: '-post-restore' });
  stdout.write(`Restored exact exported rules: new version ${result.version}\nArtifact ${file}\nPurge is required before verification.\n`);
  return { command, dryRun: false, file, result };
}

const invokedAsMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsMain) {
  runCommand(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${redactSecrets(error.message, process.env.CLOUDFLARE_API_TOKEN, process.env.CLOUDFLARE_ZONE_ID)}\n`);
    process.exitCode = 1;
  });
}
