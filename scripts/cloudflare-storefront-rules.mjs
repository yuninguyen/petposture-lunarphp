import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const HTML_RULE_DESCRIPTION = 'Cache HTML pages';
export const API_RULE_DESCRIPTION = 'Cache safe public catalog/content API GET endpoints (5 min edge TTL)';
export const HOME_RULE_DESCRIPTION = 'Cache anonymous petposture.com homepage';

const PHASE = 'http_request_cache_settings';
const ARTIFACT_SCHEMA = 'petposture-cloudflare-cache-ruleset-export-v1';
export const API_EXPRESSION = '(http.host eq "api.petposture.com") and (http.request.method eq "GET") and (http.request.uri.path matches "^/(catalog|content)/")';
const LEGACY_API_EXPRESSION = '(http.request.method eq "GET") and (http.request.uri.path matches "^/(catalog|content)/")';
const SAFE_EARLIER_CACHE_EXPRESSIONS = new Set([
  '(http.host eq "petposture.com") and (http.request.uri.path matches "^/_next/static/")',
  API_EXPRESSION,
  LEGACY_API_EXPRESSION,
]);
export const HOME_EXPRESSION = [
  '(http.host eq "petposture.com")',
  '(http.request.method in {"GET" "HEAD"})',
  '(http.request.uri.path eq "/")',
  '(http.request.uri.query eq "")',
  '(not any(http.request.headers.names[*] eq "purpose"))',
  '(not any(http.request.headers.names[*] eq "sec-purpose"))',
  '(not any(http.request.headers.names[*] eq "next-router-prefetch"))',
  '(not any(http.request.headers.names[*] eq "rsc"))',
  '(not any(http.request.headers.names[*] eq "next-router-state-tree"))',
  '(not any(http.request.headers.names[*] eq "next-router-segment-prefetch"))',
  '(not http.cookie matches r"(?i)(^|;\\s*)petposture-session=")',
  '(not http.cookie matches r"(?i)(^|;\\s*)XSRF-TOKEN=")',
  '(not http.cookie matches r"(?i)(^|;\\s*)laravel_session=")',
].join(' and ');

const LEGACY_HTML_EXPRESSION = '(http.host eq "petposture.com") and (not starts_with(http.request.uri.path, "/api/"))';

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

function normalizeExpression(expression) {
  return String(expression ?? '').replace(/\s+/g, ' ').trim();
}

function exactExpression(expression, reviewed) {
  return normalizeExpression(expression) === normalizeExpression(reviewed);
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

  const htmlExpression = htmlRules[0]?.expression;
  const apiExpression = apiRules[0]?.expression;
  const htmlReviewed = htmlRules.length === 1 && exactExpression(htmlExpression, HOME_EXPRESSION);
  const htmlLegacy = htmlRules.length === 1 && exactExpression(htmlExpression, LEGACY_HTML_EXPRESSION);
  const apiReviewed = apiRules.length === 1 && exactExpression(apiExpression, API_EXPRESSION);
  const apiLegacy = apiRules.length === 1 && exactExpression(apiExpression, LEGACY_API_EXPRESSION);
  if (htmlRules.length === 1 && !htmlReviewed) {
    failures.push(htmlLegacy
      ? `${HTML_RULE_DESCRIPTION} is a recognized broad legacy candidate and must be transformed before audit can pass`
      : `${HTML_RULE_DESCRIPTION} does not exactly match the reviewed homepage semantics`);
  }
  if (apiRules.length === 1 && !apiReviewed) failures.push(`${API_RULE_DESCRIPTION} does not exactly match the reviewed safe GET/path/host semantics`);

  const htmlIndex = htmlRules.length === 1 ? ruleset.rules.indexOf(htmlRules[0]) : -1;
  if (htmlIndex >= 0) {
    for (let index = 0; index < htmlIndex; index += 1) {
      const rule = ruleset.rules[index];
      const enabledCacheRule = rule.enabled !== false && rule.action === 'set_cache_settings' && rule.action_parameters?.cache === true;
      const expression = normalizeExpression(rule.expression);
      const conclusivelySafe = SAFE_EARLIER_CACHE_EXPRESSIONS.has(expression);
      if (enabledCacheRule && !conclusivelySafe) failures.push(`Earlier enabled rule ${rule.description ?? rule.ref ?? index + 1} creates a homepage precedence conflict because its expression is not conclusively recognized as safe`);
    }
  }

  const report = {
    pass: failures.length === 0,
    failures,
    expected: {
      html: { count: htmlRules.length, hostnameScoped: htmlReviewed || htmlLegacy, reviewed: htmlReviewed, legacyCandidate: htmlLegacy, expression: htmlExpression ?? null },
      api: { count: apiRules.length, hostnameScoped: apiReviewed, reviewed: apiReviewed, legacyCandidate: apiLegacy, expression: apiExpression ?? null },
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
  if (exactExpression(rule.expression, API_EXPRESSION)) return clone(rule);
  const legacyPathOnly = exactExpression(rule.expression, LEGACY_API_EXPRESSION);
  if (!legacyPathOnly) throw new Error(`${API_RULE_DESCRIPTION} is not the reviewed safe legacy path-only expression`);
  return { ...clone(rule), expression: API_EXPRESSION };
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
  if (requireTrusted && (!artifact || artifact.source !== 'live-cloudflare-api' || !artifact.exportedAt || typeof artifact.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(artifact.sha256))) {
    throw new Error('Refusing untrusted export: a valid SHA-256 hash is required');
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
  if (artifact && artifact.sha256 !== hash(exported)) throw new Error('Export SHA-256 does not match its ruleset payload');
  return clone(exported);
}

export function redactSecrets(value, ...secrets) {
  let redacted = String(value);
  for (const secret of secrets.filter(Boolean)) redacted = redacted.replaceAll(String(secret), '[REDACTED]');
  redacted = redacted.replace(/Bearer\s+[^"'\s]+/gi, 'Bearer [REDACTED]');
  redacted = redacted.replace(/(zones\/)[A-Za-z0-9_-]+(\/rulesets)/gi, '$1[REDACTED]$2');
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
  artifactWriter = saveArtifact,
} = {}) {
  const { command, options } = parseArgs(argv);
  if (!['export', 'audit', 'apply-home', 'restore'].includes(command)) {
    throw new Error('Usage: cloudflare-storefront-rules.mjs export|audit|apply-home|restore [--from-export path] [--execute] [--confirm-restore]');
  }
  const credentials = requireEnvironment(env);
  const live = await cloudflareRequest({ ...credentials, fetchImpl });

  if (command === 'export') {
    const artifact = createExportArtifact(live);
    const file = await artifactWriter(artifact, { artifactDir });
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
    const semanticsSafeToTransform = audit.expected.html.legacyCandidate && (audit.expected.api.reviewed || audit.expected.api.legacyCandidate);
    if (!expectedCountSafe || (!audit.pass && !semanticsSafeToTransform)) auditRuleset(live);
    const rollbackArtifact = createExportArtifact(live);
    const rollbackFile = await artifactWriter(rollbackArtifact, { artifactDir, suffix: '-pre-apply-rollback' });
    const update = buildApplyRules(live);
    const request = { name: live.name, description: live.description, kind: live.kind, phase: live.phase, rules: update.rules };
    if (!options.execute) {
      stdout.write(`DRY RUN: no Cloudflare mutation performed\nRollback export ${rollbackFile}\nWould atomically PUT ${update.rules.length} rules\n`);
      return { command, dryRun: true, rollbackFile, request };
    }
    const result = await cloudflareRequest({ method: 'PUT', ...credentials, fetchImpl, body: request });
    const artifact = { schema: 'petposture-cloudflare-cache-ruleset-apply-v1', appliedAt: new Date().toISOString(), rollbackFile, request, result };
    let file;
    try {
      file = await artifactWriter(artifact, { artifactDir, suffix: '-post-apply' });
    } catch (cause) {
      const error = new Error(`MUTATION SUCCEEDED for ruleset ${result.id} version ${result.version}, but the post-PUT artifact write failed. The Cloudflare response remains attached as error.result.`);
      error.cause = cause;
      error.mutationSucceeded = true;
      error.result = clone(result);
      error.artifact = artifact;
      throw error;
    }
    stdout.write(`Applied atomically: ruleset ${result.id} version ${result.version}\nRollback export ${rollbackFile}\nPost-change artifact ${file}\nPurge is required before verification.\n`);
    return { command, dryRun: false, rollbackFile, file, result };
  }

  if (!options.confirmRestore) throw new Error('restore requires --confirm-restore');
  const artifact = supplied?.schema === ARTIFACT_SCHEMA ? supplied : null;
  if (!artifact || artifact.source !== 'live-cloudflare-api' || !artifact.exportedAt || typeof artifact.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(artifact.sha256)) {
    throw new Error('Refusing untrusted restore export: a valid SHA-256 hash is required');
  }
  const exported = artifact.ruleset;
  assertRulesetShape(exported);
  if (artifact.sha256 !== hash(exported)) throw new Error('Export SHA-256 does not match its ruleset payload');
  if (String(exported.id) !== String(live.id)) throw new Error('Restore export ruleset ID does not match the fresh live ruleset ID');
  const staleVersion = String(exported.version) !== String(live.version);
  if (staleVersion) stdout.write(`STALE VERSION WARNING: intentionally restoring exported version ${exported.version} over live version ${live.version}.\n`);
  const request = { name: exported.name, description: exported.description, kind: exported.kind, phase: exported.phase, rules: clone(exported.rules) };
  if (!options.execute) {
    stdout.write(`DRY RUN: no Cloudflare mutation performed\nWould restore ${exported.rules.length} exact exported rules from ${options.fromExport}\n`);
    return { command, dryRun: true, request };
  }
  const result = await cloudflareRequest({ method: 'PUT', ...credentials, fetchImpl, body: request });
  const responseArtifact = { schema: 'petposture-cloudflare-cache-ruleset-restore-v1', restoredAt: new Date().toISOString(), sourceExport: options.fromExport, request, result };
  let file;
  try {
    file = await artifactWriter(responseArtifact, { artifactDir, suffix: '-post-restore' });
  } catch (cause) {
    const error = new Error(`MUTATION SUCCEEDED for ruleset ${result.id} version ${result.version}, but the post-PUT artifact write failed. The Cloudflare response remains attached as error.result.`);
    error.cause = cause;
    error.mutationSucceeded = true;
    error.result = clone(result);
    error.artifact = responseArtifact;
    throw error;
  }
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
