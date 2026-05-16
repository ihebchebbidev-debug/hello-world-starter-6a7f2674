# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:20-alpine AS runtime
# git + openssh power the optional GitHub auto-sync worker.
# wget is used by HEALTHCHECK below.
RUN apk add --no-cache git openssh-client wget tini \
  && addgroup -S app && adduser -S app -G app

WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000 \
    LOG_DIR=/app/logs

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN mkdir -p /app/logs && chown -R app:app /app
USER app

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/v1/health" >/dev/null || exit 1

# tini handles PID 1 / signal forwarding cleanly. Auto-migrate runs in-process.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
