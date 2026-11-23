'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const errorHandler = require('../src/middleware/errorHandler');
const AppError = require('../src/utils/AppError');

test('El manejador HTTP distingue validaciones, conflictos y errores internos sin filtrar detalles', async (t) => {
  const internalLogs = [];
  t.mock.method(console, 'error', (...values) => internalLogs.push(values));
  const app = express();
  const cases = [
    { error: new AppError(400, 'Datos inválidos.', [{ field: 'nombre', message: 'Obligatorio.' }]), status: 400 },
    { error: new AppError(404, 'Registro no encontrado.'), status: 404 },
    { error: Object.assign(new Error('sql: no mostrar'), { code: 'ER_DUP_ENTRY' }), status: 409 },
    { error: Object.assign(new Error('sql: no mostrar'), { code: 'ER_NO_REFERENCED_ROW_2' }), status: 400 },
    { error: Object.assign(new Error('sql: no mostrar'), { code: 'ER_ROW_IS_REFERENCED_2' }), status: 409 },
    { error: new Error('SECRET_DB_PASSWORD SQL SELECT credenciales'), status: 500 }
  ];
  cases.forEach((item, index) => app.get(`/case/${index}`, (req, res) => { throw item.error; }));
  app.use(errorHandler);
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  try {
    for (const [index, item] of cases.entries()) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/case/${index}`);
      const text = await response.text();
      assert.equal(response.status, item.status);
      const body = JSON.parse(text);
      assert.equal(body.success, false);
      assert.ok(body.message.length > 0);
      assert.doesNotMatch(text, /SECRET_DB_PASSWORD|sql:|SQL SELECT|stack|credenciales/);
    }
    assert.deepEqual(internalLogs, [['[API_ERROR]', 'Error']]);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
