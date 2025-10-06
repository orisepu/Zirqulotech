const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT, 10) || 3000;

// Leer build desde directorio custom (para zero downtime)
const buildDir = process.env.NEXT_BUILD_DIR || '.next';
const conf = {
  dev,
  hostname,
  port,
  dir: __dirname,
  conf: {
    distDir: buildDir
  }
};

const app = next(conf);
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);

      // Enviar señal "ready" a PM2 para zero downtime reload
      if (process.send) {
        process.send('ready');
      }
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});
