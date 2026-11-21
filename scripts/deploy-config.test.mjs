import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Line endings are normalised so a Windows checkout (CRLF) is read the same as the VPS one (LF).
const read = (file) => readFileSync(join(root, file), 'utf8').replace(/\r\n/g, '\n');

const compose = read('docker-compose.prod.yml');
const dockerfile = read('frontend/Dockerfile.prod');
const deploy = read('scripts/deploy-vps.sh');

// The `frontend:` service, up to the next service.
const frontend = compose.slice(compose.indexOf('\n  frontend:'), compose.indexOf('\n  admin:'));

// Without these, `next build` on the VPS cannot read the API (the public one answers 403 to the VPS, the
// default build network cannot reach the backend on the host) and bakes `/` and `/blog` with no data.
test('the frontend build can reach the backend: host network and the internal API URL as a build argument', () => {
  assert.match(frontend, /build:[\s\S]*\n {6}network: host\n/);
  assert.match(frontend, /args:[\s\S]*INTERNAL_API_URL: http:\/\/127\.0\.0\.1:8001/);
  assert.match(frontend, /NEXT_PUBLIC_API_URL: https:\/\/api\.petposture\.com/);
});

test('the running frontend container keeps its own internal API URL, the same address the build uses', () => {
  const runtime = frontend.slice(frontend.indexOf('environment:'));
  assert.match(runtime, /INTERNAL_API_URL: http:\/\/127\.0\.0\.1:8001/);
  assert.equal(
    frontend.match(/INTERNAL_API_URL: (\S+)/g)?.length,
    2,
    'once for the build argument, once for the container environment',
  );
});

test('the Dockerfile hands the internal API URL to `npm run build` only, not to the image', () => {
  assert.match(dockerfile, /^ARG INTERNAL_API_URL$/m);
  assert.match(dockerfile, /^RUN INTERNAL_API_URL=\$INTERNAL_API_URL npm run build$/m);
  assert.doesNotMatch(dockerfile, /^ENV INTERNAL_API_URL/m, 'an ENV would bake the build address into the image');
});

test('the deploy script purges Cloudflare after the release is marked deployed, and never exits on a failed purge', () => {
  const marker = deploy.indexOf('echo "$SHA" > "$CANONICAL/DEPLOYED_COMMIT"');
  const purge = deploy.indexOf('purge_output=');
  assert.ok(marker > 0 && purge > marker, 'the purge comes after DEPLOYED_COMMIT is written');
  const block = deploy.slice(purge);
  assert.match(block, /CloudflareCacheService::class\)->purgeAll\(\)/);
  assert.doesNotMatch(block, /\bexit\b/, 'a purge problem must not fail a deploy that is already live');
});

// Runs the real purge block of the script with a stand-in `docker`, under the script's own `set -euo pipefail`.
// (On Windows, `bash` can be a WSL stub that exits without running anything; only a bash that answers counts.)
const probe = spawnSync('bash', ['-c', 'echo ok'], { encoding: 'utf8' });
const skip = probe.stdout?.trim() === 'ok' ? false : 'a working bash is not available';
const purgeBlock = deploy.slice(deploy.indexOf('purge_output='));

function runPurge(output, status) {
  const harness = `set -euo pipefail
docker() { echo "Psy Shell banner"; echo "$STUB_OUT"; return $STUB_RC; }
${purgeBlock}
echo "script continued"`;
  const result = spawnSync('bash', ['-c', harness], {
    env: { ...process.env, STUB_OUT: output, STUB_RC: String(status) },
    encoding: 'utf8',
  });
  return { code: result.status, out: result.stdout, err: result.stderr };
}

test('a successful purge is reported and raises no warning', { skip }, () => {
  const run = runPurge('ok', 0);
  assert.equal(run.code, 0);
  assert.match(run.out, /Cloudflare purge: ok/);
  assert.match(run.out, /script continued/);
  assert.equal(run.err, '');
});

for (const [name, output, status, reported] of [
  ['Cloudflare answers with a failure', 'FAILED', 0, 'FAILED'],
  ['Cloudflare is not configured', 'not-configured', 0, 'not-configured'],
  ['the backend container cannot be reached', 'Error: No such container: petposture-backend', 1, 'exec-failed'],
]) {
  test(`when ${name} the deploy carries on and says so`, { skip }, () => {
    const run = runPurge(output, status);
    assert.equal(run.code, 0, 'the deploy must still succeed');
    assert.match(run.out, new RegExp(`Cloudflare purge: ${reported}`));
    assert.match(run.out, /script continued/);
    assert.match(run.err, /WARNING: Cloudflare was not purged/);
  });
}
