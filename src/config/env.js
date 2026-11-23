'use strict';

const path = require('node:path');
require('dotenv').config({
  path: process.env.ENV_FILE || path.resolve(__dirname, '../../.env'),
  quiet: true
});

function port(name, fallback) {
  const value = process.env[name] ?? String(fallback);
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error(`Revisa ${name}: debe ser un puerto entre 1 y 65535.`);
  }
  return Number(value);
}

function required(name) {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(`Falta configurar ${name}. Copia .env.example a .env y completa la conexión.`);
  }
  return value;
}

// No se imprimen contraseñas ni cadenas de conexión.
const config = {
  host: process.env.HOST || '127.0.0.1',
  port: port('PORT', 3000),
  db: {
    host: required('DB_HOST'),
    port: port('DB_PORT', 3306),
    user: required('DB_USER'),
    password: process.env.DB_PASSWORD ?? '',
    database: required('DB_NAME')
  }
};

module.exports = config;
