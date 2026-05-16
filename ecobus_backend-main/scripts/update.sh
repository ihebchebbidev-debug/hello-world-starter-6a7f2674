#!/usr/bin/env bash
# =====================================================================
# EcoBus V2 — Pull from GitHub and reload (zero-downtime)
# Run manually:        bash nodejsapp/scripts/update.sh
# Or from cron / CI:   */5 * * * * /opt/ecobus/nodejsapp/scripts/update.sh >> /var/log/ecobus-update.log 2>&1
# =====================================================================
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
APP_DIR="$(cd -- "$SCRIPT_DIR/.." &>/dev/null && pwd)"
REPO_DIR="$(cd -- "$APP_DIR/.." &>/dev/null && pwd)"
BRANCH="${ECOBUS_BRANCH:-main}"

cd "$REPO_DIR"

echo "[$(date -Is)] Fetching origin/$BRANCH"
git fetch --quiet origin "$BRANCH"

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [[ "$LOCAL" == "$REMOTE" ]]; then
  echo "[$(date -Is)] Already up to date ($LOCAL)"
  exit 0
fi

echo "[$(date -Is)] Updating $LOCAL → $REMOTE"
git reset --hard "origin/$BRANCH"

cd "$APP_DIR"

# Reinstall only if package.json changed
if git diff --name-only "$LOCAL" "$REMOTE" -- nodejsapp/package.json nodejsapp/package-lock.json | grep -q .; then
  echo "[$(date -Is)] Dependencies changed — reinstalling"
  npm ci --omit=dev || npm install --omit=dev
fi

# Run new migrations if any sql files were added/changed
if git diff --name-only "$LOCAL" "$REMOTE" -- nodejsapp/migrations | grep -q .; then
  echo "[$(date -Is)] New migrations detected — applying"
  npm run migrate
fi

echo "[$(date -Is)] Reloading PM2"
pm2 reload ecosystem.config.cjs --env production --update-env
pm2 save

echo "[$(date -Is)] ✓ Update complete"
