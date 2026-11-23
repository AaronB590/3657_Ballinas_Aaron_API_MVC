'use strict';

const express = require('express');
const pool = require('./config/database');
const routes = require('./routes');
const AppError = require('./utils/AppError');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.disable('x-powered-by');
app.set('query parser', 'simple');
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'no-store');
  if (['POST', 'PATCH', 'PUT'].includes(req.method) && !req.is('application/json')) {
    throw new AppError(415, 'Envía el cuerpo en JSON con Content-Type: application/json.');
  }
  next();
});
app.use(express.json({ limit: '32kb', strict: true }));

app.get('/api/health', async (req, res) => {
  await pool.execute('SELECT 1 AS conectado');
  res.json({ success: true, message: 'API y base de datos disponibles.', data: { status: 'ok' } });
});

app.use('/api', routes);
app.use((req, res, next) => next(new AppError(404, 'Ruta no encontrada. Revisa la dirección y el método HTTP.')));
app.use(errorHandler);

module.exports = app;
