#!/usr/bin/env bash
# =====================================================================
# EcoBus V2 — Nginx reverse proxy + (optional) Let's Encrypt TLS
#
# Usage:
#   sudo bash nodejsapp/scripts/setup-nginx.sh api.example.com [admin@example.com]
#
# Behavior:
#   - Installs nginx + certbot (idempotent)
#   - Writes /etc/nginx/sites-available/ecobus that proxies to 127.0.0.1:$PORT
#     with Socket.IO upgrade headers + long read timeout
#   - Reloads nginx
#   - If an email is supplied AND the domain resolves to this host's public
#     IP, it automatically requests/renews a Let's Encrypt certificate.
#     Otherwise it leaves you on plain HTTP and prints next steps.
#
# Re-runnable any time. Safe on Ubuntu/Debian.
# =====================================================================
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "Usage: sudo bash $0 <domain> [email-for-letsencrypt]" >&2
  exit 1
fi
if [[ $EUID -ne 0 ]]; then
  echo "Please run with sudo." >&2
  exit 1
fi

log()  { printf '\033[1;36m▸ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
APP_DIR="$(cd -- "$SCRIPT_DIR/.." &>/dev/null && pwd)"

# Read PORT from .env (default 4000)
PORT="$(grep -E '^PORT=' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2 | tr -d '[:space:]')"
PORT="${PORT:-4000}"
log "Backend will be proxied from https://$DOMAIN → http://127.0.0.1:$PORT"

# ---------- 1. Install nginx + certbot ----------
if ! command -v nginx >/dev/null 2>&1; then
  log "Installing nginx"
  apt-get update -y
  apt-get install -y nginx
else
  ok "nginx already installed"
fi

if ! command -v certbot >/dev/null 2>&1; then
  log "Installing certbot"
  apt-get install -y certbot python3-certbot-nginx
else
  ok "certbot already installed"
fi

# ---------- 2. Write the vhost ----------
CONF="/etc/nginx/sites-available/ecobus"
log "Writing $CONF"
cat >"$CONF" <<NGINX
# Managed by setup-nginx.sh — re-running this script will overwrite it.
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    # Larger client body so device firmware/log uploads don't 413.
    client_max_body_size 5m;

    # Real client IP for the API's trust-proxy logic.
    set_real_ip_from 0.0.0.0/0;
    real_ip_header X-Forwarded-For;

    # Health check (no logging spam)
    location = /healthz {
        access_log off;
        proxy_pass http://127.0.0.1:$PORT/api/v1/health;
    }

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;

        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host  \$host;

        # Socket.IO + Server-Sent Events: upgrade + keep the connection open.
        proxy_set_header Upgrade           \$http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_buffering off;
    }
}
NGINX

ln -sf "$CONF" /etc/nginx/sites-enabled/ecobus
# Drop the default catch-all so our vhost answers for the domain.
rm -f /etc/nginx/sites-enabled/default

log "Validating nginx config"
nginx -t
systemctl enable nginx >/dev/null 2>&1 || true
systemctl reload nginx
ok "nginx reverse proxy is live on http://$DOMAIN"

# ---------- 3. (Optional) Let's Encrypt ----------
if [[ -z "$EMAIL" ]]; then
  warn "No email passed — skipping HTTPS setup."
  echo "   Re-run with:  sudo bash $0 $DOMAIN you@example.com"
  exit 0
fi

# Verify the domain resolves to one of this server's public IPs before asking
# Let's Encrypt — failed challenges count toward strict rate limits.
PUBLIC_IPS="$(curl -fsS https://api.ipify.org 2>/dev/null || true) $(hostname -I 2>/dev/null || true)"
RESOLVED="$(getent hosts "$DOMAIN" | awk '{print $1}' | head -n1 || true)"
if [[ -z "$RESOLVED" ]]; then
  warn "DNS for $DOMAIN does not resolve yet."
  warn "Add an A record pointing to this server, wait for propagation, then re-run."
  exit 0
fi
if ! echo "$PUBLIC_IPS" | grep -qw "$RESOLVED"; then
  warn "$DOMAIN resolves to $RESOLVED but this server's IPs are: $PUBLIC_IPS"
  warn "Fix your DNS A record before requesting a certificate (avoids LE rate limits)."
  exit 0
fi

log "Requesting Let's Encrypt certificate for $DOMAIN"
certbot --nginx \
  --non-interactive --agree-tos \
  --email "$EMAIL" \
  --redirect \
  -d "$DOMAIN"

# certbot installs a systemd timer for renewal automatically; verify it's on.
systemctl enable --now certbot.timer >/dev/null 2>&1 || true

# Tell the API it's now behind HTTPS so generated URLs (e.g. Swagger
# `servers`, FCM links) use the right scheme.
ENV_FILE="$APP_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
  if grep -q '^PUBLIC_BASE_URL=' "$ENV_FILE"; then
    sed -i "s|^PUBLIC_BASE_URL=.*|PUBLIC_BASE_URL=https://$DOMAIN|" "$ENV_FILE"
  else
    echo "PUBLIC_BASE_URL=https://$DOMAIN" >>"$ENV_FILE"
  fi
  if grep -q '^TRUST_PROXY=' "$ENV_FILE"; then
    sed -i "s|^TRUST_PROXY=.*|TRUST_PROXY=true|" "$ENV_FILE"
  else
    echo "TRUST_PROXY=true" >>"$ENV_FILE"
  fi
  if command -v pm2 >/dev/null 2>&1 && pm2 describe ecobus-api >/dev/null 2>&1; then
    log "Reloading PM2 with new env"
    sudo -u "${SUDO_USER:-$USER}" pm2 reload ecobus-api --update-env
  fi
fi

ok "HTTPS is live."
echo
echo "  API:     https://$DOMAIN/api/v1"
echo "  Docs:    https://$DOMAIN/api/docs"
echo "  Health:  https://$DOMAIN/healthz"
echo
ok "Certificate auto-renewal is handled by the certbot.timer systemd unit."
