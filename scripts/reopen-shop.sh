#!/usr/bin/env bash
# Reopens the shop: reverts every commit whose message says "hide the shop", newest first, and squashes the
# reverts into ONE commit. See the README section "Shop hidden (SHOP-HIDDEN)".
#
# The only conflict handled here is frontend/package.json. Several commits edited its one-line "test" scripts
# (some to hide the shop, some for the Picks work), so a plain `git revert` cannot merge that line. The script
# keeps the current line and then drops the test files the reverts deleted. Any other conflict stops the
# script and leaves everything for you to resolve.
#
# Usage (from a clean checkout of main):  bash scripts/reopen-shop.sh
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Commit or stash your changes first." >&2
  exit 1
fi

commits=$(git log --grep "hide the shop" --format=%H)
if [ -z "$commits" ]; then
  echo 'No commit says "hide the shop": nothing to reopen.'
  exit 0
fi

echo "Reverting, newest first:"
git log --grep "hide the shop" --format="  %h %s"

start=$(git rev-parse HEAD)

for commit in $commits; do
  if ! git revert --no-edit "$commit" >/dev/null 2>&1; then
    conflicts=$(git diff --name-only --diff-filter=U)
    if [ "$conflicts" != "frontend/package.json" ]; then
      echo "Conflict in: $conflicts" >&2
      echo "Resolve it by hand, then run: git revert --continue" >&2
      echo "To give up instead: git revert --abort && git reset --hard $start" >&2
      exit 1
    fi
    # While reverting, "ours" is the current state: keep it, the pruning step below fixes the test list.
    git checkout --ours frontend/package.json
    git add frontend/package.json
    GIT_EDITOR=true git revert --continue >/dev/null
  fi
done

# Drop, from the one-line test scripts, the test files that the reverts deleted.
node -e '
const fs = require("fs");
const file = "frontend/package.json";
let text = fs.readFileSync(file, "utf8");
const scripts = JSON.parse(text).scripts;
for (const name of ["test", "test:node"]) {
  for (const token of (scripts[name] || "").split(" ")) {
    if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(token) && !fs.existsSync("frontend/" + token)) {
      text = text.split(" " + token).join("");
    }
  }
}
fs.writeFileSync(file, text);
JSON.parse(text);
'

git add frontend/package.json
git reset --soft "$start"
git commit -q -m 'feat(shop): reopen the shop

Reverts every commit whose message says "hide the shop" (scripts/reopen-shop.sh).
After it: deploy, purge the Cloudflare cache and publish the products again.'

echo
echo "Done: one commit, 'feat(shop): reopen the shop'."
left=$(grep -rl SHOP-HIDDEN frontend --include=*.ts --include=*.tsx --include=*.mjs 2>/dev/null || true)
if [ -n "$left" ]; then
  echo "WARNING: SHOP-HIDDEN is still in:" >&2
  echo "$left" >&2
else
  echo "grep SHOP-HIDDEN frontend: nothing left."
fi
