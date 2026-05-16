#!/usr/bin/env bash
# =====================================================================
# EcoBus V2 — One-shot server bootstrap
# Usage (on a fresh Ubuntu/Debian VPS, as a sudoer):
#   curl -fsSL https://raw.githubusercontent.com/<you>/<repo>/main/nodejsapp/scripts/deploy.sh | bash
# Or after cloning:
#   cd nodejsapp && bash scripts/deploy.sh
#
# What it does:
#   1. Installs Node.js 20 LTS, build tools, git, PM2 (idempotent)
#   2. Installs npm dependencies for the backend
#   3. Creates .env from .env.example if missing (you must edit it!)
#   4. Runs database migrations
#   5. Starts the API under PM2 and persists across reboots
#
# Re-run any time — every step is idempotent.
# =====================================================================
set -euo pipefail

log()  { printf '\033[1;36m▸ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }

# Resolve the backend dir whether the script is run from repo root or nodejsapp/
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
APP_DIR="$(cd -- "$SCRIPT_DIR/.." &>/dev/null && pwd)"
cd "$APP_DIR"
log "Backend directory: $APP_DIR"

# ---------- 1. System packages ----------
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt 20 ]]; then
  log "Installing Node.js 20 LTS"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs build-essential git
else
  ok "Node $(node -v) already installed"
fi

if ! command -v pm2 >/dev/null 2>&1; then
  log "Installing PM2 globally"
  sudo npm install -g pm2
else
  ok "PM2 $(pm2 -v) already installed"
fi

# ---------- 2. Install backend deps ----------
log "Installing backend dependencies"
npm ci --omit=dev || npm install --omit=dev

mkdir -p logs

# ---------- 3. Environment ----------
if [[ ! -f .env ]]; then
  warn ".env not found — copying from .env.example"
  cp .env.example .env
  warn "Edit $APP_DIR/.env with real DATABASE_URL, JWT_SECRET, etc., then re-run this script."
  exit 1
fi
ok ".env present"

# ---------- 4. Database migrations ----------
log "Running database migrations"
npm run migrate

# ---------- 5. Start / reload under PM2 ----------
if pm2 describe ecobus-api >/dev/null 2>&1; then
  log "Reloading existing PM2 process (zero-downtime)"
  pm2 reload ecosystem.config.cjs --env production --update-env
else
  log "Starting PM2 process for the first time"
  pm2 start ecosystem.config.cjs --env production
fi

pm2 save
# Generate the systemd unit so PM2 resurrects on reboot (idempotent)
sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null

ok "Deployment complete."
echo
pm2 status
echo
ok "API logs:    pm2 logs ecobus-api"
ok "Swagger UI:  http://<server-ip>:$(grep -E '^PORT=' .env | cut -d= -f2 || echo 4000)/api/docs"

# ---------- 6. (Optional) Nginx + HTTPS ----------
# Trigger by exporting ECOBUS_DOMAIN (and optionally ECOBUS_LE_EMAIL) before running.
if [[ -n "${ECOBUS_DOMAIN:-}" ]]; then
  echo
  log "ECOBUS_DOMAIN set — provisioning Nginx reverse proxy"
  sudo bash "$SCRIPT_DIR/setup-nginx.sh" "$ECOBUS_DOMAIN" "${ECOBUS_LE_EMAIL:-}"
else
  echo
  warn "Skipping Nginx/HTTPS. To enable, run:"
  echo "    sudo bash $SCRIPT_DIR/setup-nginx.sh api.your-domain.com you@example.com"
  echo "  Or re-run deploy.sh with:"
  echo "    ECOBUS_DOMAIN=api.your-domain.com ECOBUS_LE_EMAIL=you@example.com bash $SCRIPT_DIR/deploy.sh"
fi
