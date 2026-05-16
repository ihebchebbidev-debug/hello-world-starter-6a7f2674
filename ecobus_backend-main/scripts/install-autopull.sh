#!/usr/bin/env bash
# =====================================================================
# Installs a systemd timer that runs update.sh every 5 minutes.
# Alternative to a webhook — pulls from GitHub on a schedule.
# Usage:  sudo bash nodejsapp/scripts/install-autopull.sh
# =====================================================================
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
APP_DIR="$(cd -- "$SCRIPT_DIR/.." &>/dev/null && pwd)"
USER_NAME="${SUDO_USER:-$USER}"

cat <<UNIT | sudo tee /etc/systemd/system/ecobus-update.service >/dev/null
[Unit]
Description=EcoBus auto-pull from GitHub
After=network-online.target

[Service]
Type=oneshot
User=$USER_NAME
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/env bash $APP_DIR/scripts/update.sh
UNIT

cat <<TIMER | sudo tee /etc/systemd/system/ecobus-update.timer >/dev/null
[Unit]
Description=Run EcoBus auto-pull every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Unit=ecobus-update.service

[Install]
WantedBy=timers.target
TIMER

sudo systemctl daemon-reload
sudo systemctl enable --now ecobus-update.timer
echo "✓ Auto-pull timer installed. Status:"
systemctl status ecobus-update.timer --no-pager
