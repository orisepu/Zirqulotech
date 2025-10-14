module.exports = {
  apps: [{
    name: 'zirqulotech-frontend',
    script: 'pnpm',
    args: 'start',
    cwd: '/var/www/zirqulotech/Zirqulotech/tenant-frontend',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/pm2/nextjs-error.log',
    out_file: '/var/log/pm2/nextjs-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '500M',
    restart_delay: 4000
  }]
}
