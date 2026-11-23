'use strict';

// Punto de entrada: primero comprobar MySQL y después escuchar solicitudes.
let server;
let pool;

async function start() {
  try {
    const config = require('./config/env');
    pool = require('./config/database');
    const app = require('./app');
    await pool.execute('SELECT 1');
    server = app.listen(config.port, config.host, () => {
      console.log(`Cumbre Café API: http://${config.host}:${config.port}/api/health`);
    });
    server.on('error', async (error) => {
      console.error('No se pudo iniciar el servidor HTTP.', error.code || error.name);
      await pool.end();
      process.exitCode = 1;
    });
  } catch (error) {
    console.error('No se pudo iniciar la API. Revisa .env, el servicio MySQL y la importación del script SQL.');
    console.error('Código:', error.code || error.name);
    if (pool) await pool.end();
    process.exitCode = 1;
  }
}

async function close() {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();
}

process.once('SIGINT', close);
process.once('SIGTERM', close);
start();
