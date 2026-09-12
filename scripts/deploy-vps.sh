#!/usr/bin/env bash
# Deploy a git ref to production via an isolated release directory.
#
# Run this ON THE VPS as root:
#   scripts/deploy-vps.sh [git-ref]     (defaults to origin/main)
#
# What it does, and why each step exists:
# - Archives the ref into /opt/petposture-releases/<sha>/, never touching
#   /opt/petposture's working tree (which has deliberately dirty files that
#   `git pull`/checkout would destroy -- see the deployment gate matrix).
# - Symlinks backend/.env and frontend/.env from the canonical /opt/petposture
#   copies so runtime secrets never need to be re-entered per release.
# - Symlinks backend/storage/app/public and backend/storage/logs from the
#   canonical copies too. Skipping this (as the 2026-09-12 deploy did) means
#   every previously uploaded logo/favicon/product/blog image 404s the
#   moment the release switches, because a fresh `git archive` only contains
#   a `.gitignore` in those directories.
# - Records ROLLBACK_IMAGES in the new release directory BEFORE switching
#   over, capturing the digests that are about to stop being live -- so a
#   rollback target always exists for every deploy, not just some of them.
# - Only updates the canonical DEPLOYED_COMMIT / DEPLOYED_RELEASE markers
#   after a local health check passes, so those files never claim a deploy
#   succeeded when it didn't (and never go stale the way they did before
#   this script existed).
set -euo pipefail

CANONICAL=/opt/petposture
RELEASES=/opt/petposture-releases
REF="${1:-origin/main}"

git -C "$CANONICAL" fetch origin main
SHA="$(git -C "$CANONICAL" rev-parse "$REF")"
RELEASE_DIR="$RELEASES/$SHA"

if [ -d "$RELEASE_DIR" ]; then
    echo "Release $SHA already exists at $RELEASE_DIR -- nothing to archive." >&2
else
    mkdir -p "$RELEASE_DIR"
    git -C "$CANONICAL" archive "$SHA" | tar -x -C "$RELEASE_DIR"
fi

ln -sfn "$CANONICAL/backend/.env" "$RELEASE_DIR/backend/.env"
ln -sfn "$CANONICAL/frontend/.env" "$RELEASE_DIR/frontend/.env"

rm -rf "$RELEASE_DIR/backend/storage/app/public"
ln -sfn "$CANONICAL/backend/storage/app/public" "$RELEASE_DIR/backend/storage/app/public"
rm -rf "$RELEASE_DIR/backend/storage/logs"
ln -sfn "$CANONICAL/backend/storage/logs" "$RELEASE_DIR/backend/storage/logs"

backend_digest="$(docker image inspect petposture-backend:prod --format '{{index .RepoDigests 0}}' 2>/dev/null | sed 's/^.*@//' || echo unknown)"
frontend_digest="$(docker image inspect petposture-frontend:prod --format '{{index .RepoDigests 0}}' 2>/dev/null | sed 's/^.*@//' || echo unknown)"
cat > "$RELEASE_DIR/ROLLBACK_IMAGES" <<EOF
backend_image=$backend_digest
frontend_image=$frontend_digest
EOF

cd "$RELEASE_DIR"
docker compose -f docker-compose.prod.yml -p petposture build

# docker-compose.prod.yml pins fixed container_name values. If the running
# containers were started under a different (or no) Compose project label
# -- as every prior manual deploy did -- Compose won't recognize them as
# "its own" and refuses to replace them, erroring on a name conflict
# instead. Since names are already fixed and globally unique, drop
# ownership tracking entirely: remove any container with these exact names
# before creating fresh ones, regardless of which project (if any) made them.
docker rm -f petposture-backend petposture-frontend >/dev/null 2>&1 || true
docker compose -f docker-compose.prod.yml -p petposture up -d --force-recreate backend frontend

# `curl ... || echo 000` was wrong: on a connection failure curl's -w still
# writes "000" itself *and* the || branch fires too, concatenating into
# "000000" -- which never equals "000" below, so a genuinely down backend
# would silently pass this check. Overwrite the variable on failure instead
# of appending to it. Retry briefly since FrankenPHP/Laravel cold boot can
# take longer than a fixed sleep.
check_status() {
    local url="$1" status
    for _ in 1 2 3 4 5 6; do
        status="$(curl -s -o /dev/null -w '%{http_code}' "$url")" || status="000"
        if [ "$status" != "000" ]; then
            echo "$status"
            return 0
        fi
        sleep 3
    done
    echo "000"
}

backend_status="$(check_status http://127.0.0.1:8001/)"
frontend_status="$(check_status http://127.0.0.1:3001/)"
echo "backend local status: $backend_status"
echo "frontend local status: $frontend_status"

if [ "$backend_status" = "000" ] || [ "$frontend_status" = "000" ]; then
    echo "Health check failed -- NOT updating DEPLOYED_COMMIT/DEPLOYED_RELEASE." >&2
    echo "Investigate before retrying; the previous release is still what those markers point to." >&2
    exit 1
fi

echo "$SHA" > "$CANONICAL/DEPLOYED_COMMIT"
echo "deployed_release=$RELEASE_DIR" > "$CANONICAL/DEPLOYED_RELEASE"
echo "Deployed $SHA. Rollback target recorded in $RELEASE_DIR/ROLLBACK_IMAGES."
