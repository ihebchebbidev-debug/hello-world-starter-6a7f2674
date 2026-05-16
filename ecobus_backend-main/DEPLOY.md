# EcoBus V2 — Deployment Guide

One-command deployment for the Node.js backend with **PM2** and optional
**auto-pull from GitHub**. Designed for a fresh Ubuntu/Debian VPS
(DigitalOcean, Hetzner, OVH, AWS Lightsail, etc.).

---

## 0. What you need before you start

| Item | Notes |
|---|---|
| A Linux VPS | Ubuntu 22.04+ or Debian 12 recommended, ≥1 vCPU / 1 GB RAM |
| SSH access as a sudoer | `ssh user@your-server` |
| A PostgreSQL database | Local, Neon, Supabase, RDS, Railway… anything reachable |
| Your GitHub repo URL | e.g. `git@github.com:your-org/ecobus.git` |

> **Tip:** Open ports `22` (SSH) and `4000` (or whatever you set as `PORT`)
> in your firewall. If you front the API with Nginx + TLS, only `80/443` need
> to be public.

---

## 1. Clone the repo on the server

```bash
sudo mkdir -p /opt && sudo chown "$USER" /opt
cd /opt
git clone https://github.com/<your-org>/<your-repo>.git ecobus
cd ecobus/nodejsapp
```

---

## 2. Configure environment variables

```bash
cp .env.example .env
nano .env
```

At minimum set:

- `DATABASE_URL` — Postgres connection string
- `JWT_SECRET` — generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `CORS_ORIGIN` — your frontend URL (comma-separated for multiple)
- `PORT` — defaults to `4000`

Save and exit.

---

## 3. One-shot install + start

```bash
bash scripts/deploy.sh
```

This script is **idempotent** — safe to re-run any time. It will:

1. Install Node.js 20 LTS, build tools, git, and PM2 (only if missing)
2. Run `npm ci --omit=dev`
3. Verify `.env` is present
4. Apply database migrations (`npm run migrate`)
5. Start the API under PM2 in **production** mode
6. Save PM2 state and register a **systemd unit** so the API auto-starts on reboot

When it finishes, you'll see PM2's status table and the URLs:

- API: `http://<server-ip>:4000/api/v1`
- Swagger: `http://<server-ip>:4000/api/docs`
- Health: `http://<server-ip>:4000/api/v1/health`

---

## 4. Day-to-day PM2 commands

```bash
pm2 status                    # list processes
pm2 logs ecobus-api           # tail logs (Ctrl+C to exit)
pm2 logs ecobus-api --lines 200
pm2 restart ecobus-api        # restart (brief downtime)
pm2 reload ecobus-api         # zero-downtime reload
pm2 stop ecobus-api
pm2 monit                     # live CPU / memory dashboard
pm2 flush                     # clear log files
```

---

## 5. Updating after a GitHub push (manual)

```bash
cd /opt/ecobus
bash nodejsapp/scripts/update.sh
```

`update.sh` is smart:

- Skips work if the remote hasn't moved
- Re-runs `npm ci` only when `package.json` / `package-lock.json` changed
- Runs new SQL migrations only when files in `migrations/` changed
- Performs a **zero-downtime PM2 reload**

---

## 6. Auto-pulling from GitHub (pick one)

### Option A — systemd timer (no GitHub config needed)

Polls origin every 5 minutes:

```bash
sudo bash nodejsapp/scripts/install-autopull.sh
```

Inspect / control:

```bash
systemctl status ecobus-update.timer
systemctl list-timers | grep ecobus
journalctl -u ecobus-update.service -n 50 --no-pager
```

To change the interval, edit `/etc/systemd/system/ecobus-update.timer` and run
`sudo systemctl daemon-reload && sudo systemctl restart ecobus-update.timer`.

### Option B — GitHub Actions push deploy (instant)

Add this workflow at `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: bash /opt/ecobus/nodejsapp/scripts/update.sh
```

Then in GitHub → Settings → Secrets, add `SSH_HOST`, `SSH_USER`, `SSH_KEY`
(an SSH private key whose public half is in `~/.ssh/authorized_keys` on the server).

> Use **either** Option A **or** Option B, not both.

---

## 7. Nginx reverse proxy + HTTPS (one command)

A dedicated script automates everything: installs Nginx + Certbot, writes a
hardened vhost (Socket.IO upgrade, real-client-IP, 5 MB body, long timeouts),
and — when DNS is ready — provisions a free Let's Encrypt certificate with
auto-renewal.

### Option A — run it standalone

```bash
# Plain HTTP only (good for testing the proxy)
sudo bash nodejsapp/scripts/setup-nginx.sh api.yourdomain.com

# Full HTTPS with Let's Encrypt + auto-renewal
sudo bash nodejsapp/scripts/setup-nginx.sh api.yourdomain.com you@example.com
```

### Option B — bake it into `deploy.sh`

```bash
ECOBUS_DOMAIN=api.yourdomain.com \
ECOBUS_LE_EMAIL=you@example.com \
bash nodejsapp/scripts/deploy.sh
```

### What the script does for you

1. Installs `nginx` and `certbot` if missing.
2. Generates `/etc/nginx/sites-available/ecobus` proxying `https://<domain>`
   → `http://127.0.0.1:$PORT` (read from your `.env`).
3. Disables the default Nginx vhost so your domain answers correctly.
4. Validates and reloads Nginx.
5. **Pre-flight checks DNS** — verifies the domain resolves to this server
   before calling Let's Encrypt (avoids burning rate-limit budget).
6. Requests the certificate non-interactively, enables HTTP→HTTPS redirect,
   and ensures `certbot.timer` is active for auto-renewal every 12 h.
7. Sets `PUBLIC_BASE_URL=https://<domain>` and `TRUST_PROXY=true` in `.env`,
   then zero-downtime reloads PM2 so the API knows it's behind HTTPS.

### Re-running

The script is idempotent. Re-run it any time to refresh the vhost (e.g. after
changing `PORT`) or to add HTTPS to an existing HTTP setup.

### Troubleshooting HTTPS

| Symptom | Fix |
|---|---|
| Script skips cert with "DNS does not resolve" | Add an A record for the domain → server IP, wait for propagation, re-run |
| `Too many failed authorizations` from Let's Encrypt | Stop retrying; wait the rate-limit window (~1 h) before another attempt |
| Cert valid but browser shows mixed content | Confirm `PUBLIC_BASE_URL` in `.env` is `https://…` and PM2 was reloaded |
| Socket.IO disconnects after a minute | Already handled — `proxy_read_timeout 3600s` is in the generated vhost |


---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `pm2: command not found` after install | `sudo npm install -g pm2`, then re-run `deploy.sh` |
| API restarts in a loop | `pm2 logs ecobus-api` — usually a bad `DATABASE_URL` or missing migration |
| `ECONNREFUSED` to Postgres | Verify the DB is reachable from the VPS: `psql "$DATABASE_URL" -c 'select 1'` |
| Swagger 404 | Confirm `API_PREFIX=/api/v1` in `.env` and visit `/api/docs` |
| Auto-pull not running | `journalctl -u ecobus-update.service -n 50` |
| Reboot lost the process | `pm2 save` and re-run the `pm2 startup` command printed by it |

---

## 9. Uninstall / clean up

```bash
pm2 delete ecobus-api && pm2 save
sudo systemctl disable --now ecobus-update.timer || true
sudo rm -f /etc/systemd/system/ecobus-update.{service,timer}
sudo systemctl daemon-reload
```
