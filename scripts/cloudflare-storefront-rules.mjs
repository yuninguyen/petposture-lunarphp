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
export const LIVE_API_EXPRESSION = '(http.host eq "api.petposture.com") and (http.request.method eq "GET") and (http.request.uri.path eq "/api/settings" or http.request.uri.path eq "/api/site-media" or http.request.uri.path eq "/api/checkout/payment-methods" or http.request.uri.path eq "/api/categories" or http.request.uri.path eq "/api/blog/categories" or starts_with(http.request.uri.path, "/api/products") or starts_with(http.request.uri.path, "/api/brands") or starts_with(http.request.uri.path, "/api/posts") or starts_with(http.request.uri.path, "/api/breeds") or starts_with(http.request.uri.path, "/api/solutions"))';
export const LIVE_LEGACY_HTML_EXPRESSION = '(http.host eq "petposture.com") and (not starts_with(http.request.uri.path, "/api/")) and (not starts_with(http.request.uri.path, "/account")) and (not starts_with(http.request.uri.path, "/cart")) and (not starts_with(http.request.uri.path, "/checkout")) and (not starts_with(http.request.uri.path, "/sign-in")) and (not starts_with(http.request.uri.path, "/sign-up")) and (not starts_with(http.request.uri.path, "/returns")) and (not starts_with(http.request.uri.path, "/admin"))';
export const LIVE_LEGACY_HTML_EXPRESSION_SHA256 = 'cf3920616575be3acb242523a918646cb76dd854a28721e1670731d492bc8a88';
const LEGACY_API_EXPRESSION = '(http.request.method eq "GET") and (http.request.uri.path matches "^/(catalog|content)/")';
const SAFE_EARLIER_CACHE_EXPRESSIONS = new Set([
  '(http.host eq "petposture.com") and (http.request.uri.path matches "^/_next/static/")',
  API_EXPRESSION,
  LIVE_API_EXPRESSION,
  LEGACY_API_EXPRESSION,
]);
export const HOME_EXPRESSION = [
  '(http.host eq "petposture.com")',
  '(http.request.method in {"GET" "HEAD"})',
  '(http.request.uri.path eq "/")',
  '(http.request.uri.query eq "")',
  // Header names arrive in whatever case the client sent (Cloudflare only
  // lowercases them on HTTP/2). Every clause here must run through lower()
  // or a same-cased browser/Next.js request silently skips the exclusion.
  '(not any(lower(http.request.headers.names[*])[*] eq "purpose"))',
  '(not any(lower(http.request.headers.names[*])[*] eq "sec-purpose"))',
  '(not any(lower(http.request.headers.names[*])[*] eq "next-router-prefetch"))',
  '(not any(lower(http.request.headers.names[*])[*] eq "rsc"))',
  '(not any(lower(http.request.headers.names[*])[*] eq "next-router-state-tree"))',
  '(not any(lower(http.request.headers.names[*])[*] eq "next-router-segment-prefetch"))',
  '(not any(lower(http.request.headers.names[*])[*] eq "cookie"))',
].join(' and ');

export const HOME_BYPASS_DESCRIPTION = 'Bypass excluded petposture.com homepage requests';
export const HOME_BYPASS_EXPRESSION = `(http.host eq "petposture.com") and (http.request.uri.path eq "/") and (not (${HOME_EXPRESSION}))`;
const HOME_BYPASS_REF = 'bypass_excluded_petposture_homepage';
// Recorded v16 historical rule deliberately lacks lower(); never re-enable it.
const V16_DISABLED_HTML_EXPRESSION = '(http.host eq "petposture.com") and (http.request.method in {"GET" "HEAD"}) and (http.request.uri.path eq "/") and (http.request.uri.query eq "") and (not any(http.request.headers.names[*] eq "purpose")) and (not any(http.request.headers.names[*] eq "sec-purpose")) and (not any(http.request.headers.names[*] eq "next-router-prefetch")) and (not any(http.request.headers.names[*] eq "rsc")) and (not any(http.request.headers.names[*] eq "next-router-state-tree")) and (not any(http.request.headers.names[*] eq "next-router-segment-prefetch")) and (not any(http.request.headers.names[*] eq "cookie"))';
const V16_STATIC_EXPRESSION = '((http.host eq "petposture.com") and starts_with(http.request.uri.path, "/_next/static/")) or ((http.host eq "api.petposture.com") and starts_with(http.request.uri.path, "/storage/"))';

export function buildHomeBypassRule() {
  return {
    ref: HOME_BYPASS_REF,
    description: HOME_BYPASS_DESCRIPTION,
    expression: HOME_BYPASS_EXPRESSION,
    enabled: true,
    action: 'set_cache_settings',
    action_parameters: { cache: false },
  };
}

export function auditHomeBypassRuleset(ruleset, { throwOnFailure = true } = {}) {
  assertRulesetShape(ruleset);
  const respectOrigin = { browser_ttl: { mode: 'respect_origin' }, cache: true, edge_ttl: { mode: 'respect_origin' } };
  const reviewed = [
    { description: HTML_RULE_DESCRIPTION, enabled: false, expression: V16_DISABLED_HTML_EXPRESSION, action_parameters: respectOrigin },
    { description: 'Long cache for Next.js static assets and uploaded storage files', enabled: true, expression: V16_STATIC_EXPRESSION,
      action_parameters: { browser_ttl: { default: 2592000, mode: 'override_origin' }, cache: true, edge_ttl: { default: 2592000, mode: 'override_origin' } } },
    { description: API_RULE_DESCRIPTION, enabled: true, expression: LIVE_API_EXPRESSION,
      action_parameters: { browser_ttl: { default: 60, mode: 'override_origin' }, cache: true, edge_ttl: { default: 300, mode: 'override_origin' } } },
    { description: HOME_RULE_DESCRIPTION, enabled: true, expression: HOME_EXPRESSION, action_parameters: respectOrigin },
    buildHomeBypassRule(),
  ];
  const failures = [];
  if (![4, 5].includes(ruleset.rules.length)) failures.push('Only the reviewed four-rule baseline or five-rule bypass topology is permitted');
  const refs = new Set();
  const ids = new Set();
  for (let index = 0; index < ruleset.rules.length; index += 1) {
    const rule = ruleset.rules[index];
    const expected = reviewed[index];
    if (!rule || !expected) { failures.push(`Unreviewed rule at order ${index + 1}`); continue; }
    for (const field of ['description', 'enabled']) {
      if (rule[field] !== expected[field]) failures.push(`Rule ${index + 1} ${field} differs from reviewed topology`);
    }
    if (rule.action !== 'set_cache_settings') failures.push(`Rule ${index + 1} action drift`);
    if (!exactExpression(rule.expression, expected.expression)) failures.push(`Rule ${index + 1} expression drift`);
    if (stableJson(rule.action_parameters) !== stableJson(expected.action_parameters)) failures.push(`Rule ${index + 1} action_parameters drift`);
    if (typeof rule.ref !== 'string' || !rule.ref.trim() || refs.has(rule.ref)) failures.push(`Rule ${index + 1} missing or duplicate ref`);
    refs.add(rule.ref);
    if ((index === 4 && rule.ref !== HOME_BYPASS_REF) || (index < 4 && rule.ref === HOME_BYPASS_REF)) failures.push(`Rule ${index + 1} unreviewed bypass ref`);
    // Baseline IDs/refs are export-bound, not pinned to sanitized fixture identities.
    if (index < 4 && (typeof rule.id !== 'string' || !rule.id.trim())) failures.push(`Rule ${index + 1} missing ID`);
    if (rule.id !== undefined) {
      if (ids.has(rule.id)) failures.push(`Rule ${index + 1} duplicate ID`);
      ids.add(rule.id);
    }
  }
  const report = {
    pass: failures.length === 0, failures,
    rules: ruleset.rules.map((rule, index) => ({ order: index + 1, ...clone(rule) })),
    bypassPresent: ruleset.rules.some((rule) => rule?.description === HOME_BYPASS_DESCRIPTION),
  };
  if (!report.pass && throwOnFailure) throw new Error(`Homepage bypass ruleset audit failed closed:\n- ${failures.join('\n- ')}`);
  return report;
}

export function buildHomeBypassRules(ruleset) {
  const audit = auditHomeBypassRuleset(ruleset);
  const rules = clone(ruleset.rules);
  if (!audit.bypassPresent) rules.push(buildHomeBypassRule());
  auditHomeBypassRuleset({ ...ruleset, rules });
  return { rules, changed: !audit.bypassPresent };
}

function rejectSeparateHomepage(ruleset) {
  if (findExact(ruleset.rules, HOME_RULE_DESCRIPTION).length > 0) {
    throw new Error('Separate active homepage topology requires apply-home-bypass; apply-home must not create two allow rules');
  }
}

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
  const precedenceConflicts = [];

  if (htmlRules.length === 0) failures.push(`${HTML_RULE_DESCRIPTION} is missing`);
  if (htmlRules.length > 1) failures.push(`${HTML_RULE_DESCRIPTION} is duplicated`);
  if (apiRules.length === 0) failures.push(`${API_RULE_DESCRIPTION} is missing`);
  if (apiRules.length > 1) failures.push(`${API_RULE_DESCRIPTION} is duplicated`);

  const htmlExpression = htmlRules[0]?.expression;
  const apiExpression = apiRules[0]?.expression;
  const htmlReviewed = htmlRules.length === 1 && exactExpression(htmlExpression, HOME_EXPRESSION);
  const htmlLegacy = htmlRules.length === 1 && [LEGACY_HTML_EXPRESSION, LIVE_LEGACY_HTML_EXPRESSION]
    .some((candidate) => exactExpression(htmlExpression, candidate));
  const apiReviewed = apiRules.length === 1 && [API_EXPRESSION, LIVE_API_EXPRESSION].some((reviewed) => exactExpression(apiExpression, reviewed));
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
      if (enabledCacheRule && !conclusivelySafe) {
        const conflict = `Earlier enabled rule ${rule.description ?? rule.ref ?? index + 1} creates a homepage precedence conflict because its expression is not conclusively recognized as safe`;
        precedenceConflicts.push(conflict);
        failures.push(conflict);
      }
    }
  }

  const report = {
    pass: failures.length === 0,
    failures,
    precedenceConflicts,
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
    enabled: true,
    expression: home.expression,
    action: home.action,
    action_parameters: home.action_parameters,
  };
}

function scopeApiRule(rule) {
  if ([API_EXPRESSION, LIVE_API_EXPRESSION].some((reviewed) => exactExpression(rule.expression, reviewed))) return clone(rule);
  const legacyPathOnly = exactExpression(rule.expression, LEGACY_API_EXPRESSION);
  if (!legacyPathOnly) throw new Error(`${API_RULE_DESCRIPTION} is not the reviewed safe legacy path-only expression`);
  return { ...clone(rule), expression: API_EXPRESSION };
}

export function buildApplyRules(ruleset) {
  assertRulesetShape(ruleset);
  rejectSeparateHomepage(ruleset);
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

export function buildMutationRequest(ruleset, rules) {
  return { name: ruleset.name, description: ruleset.description, rules: clone(rules) };
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
  if (!['export', 'audit', 'apply-home', 'apply-home-bypass', 'restore'].includes(command)) {
    throw new Error('Usage: cloudflare-storefront-rules.mjs export|audit|apply-home|apply-home-bypass|restore [--from-export path] [--execute] [--confirm-restore]');
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

  if (command === 'apply-home' || command === 'apply-home-bypass') {
    parseExport(supplied, live, { requireTrusted: true });
    const bypass = command === 'apply-home-bypass';
    let update;
    if (bypass) {
      update = buildHomeBypassRules(live);
      const report = auditHomeBypassRuleset({ ...live, rules: update.rules });
      for (const rule of report.rules) {
        stdout.write(`${rule.order}. ${rule.description}\n   enabled=${rule.enabled} action=${rule.action}\n   ${rule.expression}\n   ${JSON.stringify(rule.action_parameters)}\n`);
      }
      if (!update.changed) {
        stdout.write('NO OP: reviewed homepage bypass already present; no Cloudflare mutation performed\n');
        return { command, changed: false, dryRun: !options.execute, result: clone(live) };
      }
    } else {
      rejectSeparateHomepage(live);
      const audit = auditRuleset(live, { throwOnFailure: false });
      const expectedCountSafe = audit.expected.html.count === 1 && audit.expected.api.count === 1;
      const semanticsSafeToTransform = (audit.expected.html.reviewed || audit.expected.html.legacyCandidate)
        && (audit.expected.api.reviewed || audit.expected.api.legacyCandidate);
      if (!expectedCountSafe || audit.precedenceConflicts.length > 0 || !semanticsSafeToTransform) auditRuleset(live);
    }
    const rollbackArtifact = createExportArtifact(live);
    const rollbackFile = await artifactWriter(rollbackArtifact, { artifactDir, suffix: '-pre-apply-rollback' });
    update ??= buildApplyRules(live);
    const request = buildMutationRequest(live, update.rules);
    if (bypass) auditHomeBypassRuleset({ ...live, rules: request.rules });
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
  const request = buildMutationRequest(exported, exported.rules);
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
