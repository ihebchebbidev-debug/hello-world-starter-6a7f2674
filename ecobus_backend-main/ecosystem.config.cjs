/**
 * PM2 process file for EcoBus V2 backend.
 * Run with:  pm2 start ecosystem.config.cjs --env production
 *
 * - `instances: 'max'` enables Node clustering across CPU cores.
 * - Socket.IO sticky sessions are NOT required when running behind a single
 *   Node process. If you scale to multiple PM2 instances, add the
 *   socket.io-redis adapter so events fan out across workers.
 */
module.exports = {
  apps: [
    {
      name: 'ecobus-api',
      cwd: __dirname,
      script: 'src/server.js',
      exec_mode: 'fork',          // change to 'cluster' once Redis adapter is wired
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      kill_timeout: 5000,
      wait_ready: false,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'production',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
