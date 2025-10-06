module.exports = {
  apps: [
    {
      name: 'tenant-frontend',
      cwd: './tenant-frontend',
      script: './server.js',
      instances: 2,
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      // Zero downtime deployment config
      wait_ready: true,              // Espera señal de "ready" antes de considerar la app iniciada
      listen_timeout: 10000,         // Timeout para esperar señal ready (10s)
      kill_timeout: 5000,            // Tiempo para graceful shutdown (5s)
      shutdown_with_message: false   // No esperar mensaje de shutdown
    },
    {
      name: 'tenants-backend',
      cwd: './tenants-backend',
      script: 'venv/bin/python',
      args: '-m uvicorn django_test_app.asgi:application --host 0.0.0.0 --port 8000 --workers 4',
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        DJANGO_SETTINGS_MODULE: 'django_test_app.settings',
        PYTHONUNBUFFERED: '1'
      },
      env_development: {
        DJANGO_SETTINGS_MODULE: 'django_test_app.settings',
        PYTHONUNBUFFERED: '1',
        DEBUG: 'True'
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }
  ]
};
