'use strict';

// Prueba HTTP real contra MySQL. Sólo crea y elimina sus propios registros temporales.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const config = require('../src/config/env');
const pool = require('../src/config/database');
const app = require('../src/app');
const { modules, resourcePath } = require('./fixtures');

const report = {
  project: 'Cumbre Café API MVC',
  startedAt: new Date().toISOString(),
  tool: 'Node.js fetch: solicitudes HTTP reales a Express y consultas a MySQL',
  nodeVersion: process.version,
  results: [],
  checks: [],
  selectedEvidence: []
};
const refs = {};
const createBodies = {};
const deleted = new Set();
const tag = Date.now().toString(36);
let server;
let baseUrl;
let baseline;
let extraLink;
let failure;

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [
      key, ['password', 'password_hash'].includes(key) ? '[OCULTO: dato de prueba]' : redact(val)
    ]));
  }
  return value;
}

function noSecrets(value) {
  if (value && typeof value === 'object') {
    assert.ok(!Object.hasOwn(value, 'password'), 'La respuesta no debe contener password.');
    assert.ok(!Object.hasOwn(value, 'password_hash'), 'La respuesta no debe contener password_hash.');
    Object.values(value).forEach(noSecrets);
  }
}

async function request(table, title, method, endpoint, body, expectedStatus, options = {}) {
  const start = performance.now();
  const response = await fetch(baseUrl + endpoint, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': options.contentType || 'application/json' },
    body: body === undefined ? undefined : (options.raw ? body : JSON.stringify(body))
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { invalidJsonResponse: text }; }
  const entry = {
    id: report.results.length + 1,
    table,
    title,
    method,
    path: endpoint,
    requestedAt: new Date().toISOString(),
    request: {
      headers: body === undefined ? {} : { 'Content-Type': options.contentType || 'application/json' },
      ...(body === undefined ? {} : { body: redact(body) })
    },
    response: {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type'),
        ...(response.headers.get('location') ? { location: response.headers.get('location') } : {})
      },
      body: json
    },
    expectedStatus,
    passed: response.status === expectedStatus && json.success === (expectedStatus < 400),
    durationMs: Number((performance.now() - start).toFixed(2))
  };
  report.results.push(entry);
  if (options.evidence) report.selectedEvidence.push(entry.id);
  assert.equal(response.status, expectedStatus, `${title}: HTTP esperado ${expectedStatus}, recibido ${response.status}; ${json.message}`);
  assert.equal(json.success, expectedStatus < 400, `${title}: propiedad success incorrecta.`);
  assert.match(response.headers.get('content-type') || '', /application\/json/);
  noSecrets(json);
  return json;
}

function check(name, action) {
  try { action(); report.checks.push({ name, passed: true }); }
  catch (error) { report.checks.push({ name, passed: false }); throw error; }
}

async function snapshot() {
  const result = {};
  for (const module of modules) {
    // Tabla y columnas proceden de fixtures constantes del proyecto, no de HTTP.
    const order = module.id || 'id_cafeteria, id_grano';
    const [rows] = await pool.query(`SELECT * FROM ${module.table} ORDER BY ${order}`);
    result[module.table] = rows;
  }
  return result;
}

async function remove(module) {
  await request(module.table, 'Eliminar registro', 'DELETE', resourcePath(module, refs[module.table]), undefined, 200);
  deleted.add(module.table);
  await request(module.table, 'Consultar después de eliminar', 'GET', resourcePath(module, refs[module.table]), undefined, 404);
}

async function main() {
  if (!config.db.database.endsWith('_test') && !process.argv.includes('--allow-demo-db')) {
    throw new Error('Usa una base terminada en _test. Para usar la base local de demostración, ejecuta npm run test:api -- --allow-demo-db.');
  }
  const [[engine]] = await pool.query('SELECT VERSION() AS version');
  report.databaseVersion = engine.version;
  baseline = await snapshot();
  report.initialRows = Object.fromEntries(modules.map(m => [m.table, baseline[m.table].length]));
  server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  report.baseUrl = baseUrl;
  await request('sistema', 'Conexión HTTP y MySQL', 'GET', '/api/health', undefined, 200);

  for (const module of modules) {
    const body = module.create(refs, tag);
    createBodies[module.table] = body;
    const created = await request(module.table, 'Crear registro', 'POST', `/api/${module.path}`, body, 201, { evidence: true });
    refs[module.table] = created.data;
    const endpoint = resourcePath(module, created.data);
    const post = report.results.at(-1);
    check(`${module.table}: Location identifica el recurso creado`, () => assert.equal(post.response.headers.location, endpoint));
    check(`${module.table}: POST persiste todos los campos enviados`, () => {
      for (const [key, value] of Object.entries(body)) {
        if (key !== 'password') assert.equal(created.data[key], typeof value === 'boolean' ? Number(value) : value);
      }
    });
    const found = await request(module.table, 'Consultar por identificador', 'GET', endpoint, undefined, 200, { evidence: true });
    check(`${module.table}: GET recupera el registro creado`, () => assert.deepEqual(found.data, created.data));
    const listed = await request(module.table, 'Listar registros', 'GET', `/api/${module.path}?limit=100&offset=0`, undefined, 200);
    check(`${module.table}: listado incluye el nuevo registro`, () => {
      assert.equal(listed.pagination.limit, 100);
      assert.equal(listed.pagination.count, listed.data.length);
      assert.ok(listed.data.some(row => resourcePath(module, row) === endpoint));
    });
    const updated = await request(module.table, 'Actualizar parcialmente', 'PATCH', endpoint, module.patch, 200);
    check(`${module.table}: PATCH actualiza los valores enviados`, () => {
      for (const [key, value] of Object.entries(module.patch)) {
        assert.equal(updated.data[key], typeof value === 'boolean' ? Number(value) : value);
      }
    });
    const persisted = await request(module.table, 'Verificar actualización persistida', 'GET', endpoint, undefined, 200);
    check(`${module.table}: modificación persiste en MySQL`, () => assert.deepEqual(persisted.data, updated.data));
    await request(module.table, 'Actualizar con los mismos valores', 'PATCH', endpoint, module.patch, 200);
    await request(module.table, 'Rechazar creación vacía', 'POST', `/api/${module.path}`, {}, 400);
    await request(module.table, 'Rechazar actualización vacía', 'PATCH', endpoint, {}, 400);
    const invalidId = `/api/${module.path}/` + (module.id ? '0' : '0/1');
    await request(module.table, 'Rechazar identificador inválido', 'GET', invalidId, undefined, 400);
    const missing = ['roles'].includes(module.table) ? '255' : ['zonas_origen', 'metodos_preparacion'].includes(module.table) ? '65535' : '4294967295';
    await request(module.table, 'Consultar identificador inexistente', 'GET', `/api/${module.path}/${module.id ? missing : '4294967295/4294967295'}`, undefined, 404);
    await request(module.table, 'Rechazar paginación inválida', 'GET', `/api/${module.path}?limit=0`, undefined, 400);
  }

  for (const module of modules.filter(m => m.table !== 'mensajes_contacto')) {
    await request(module.table, 'Rechazar duplicado', 'POST', `/api/${module.path}`, createBodies[module.table], 409);
  }
  const foreignKeys = [
    ['usuarios', 'id_rol', 255], ['productores', 'id_zona', 65535],
    ['granos', 'id_productor', 4294967295], ['cafeterias_aliadas', 'id_usuario_resp', 4294967295],
    ['cafeteria_grano', 'id_cafeteria', 4294967295], ['cafeteria_grano', 'id_grano', 4294967295],
    ['mensajes_contacto', 'id_usuario_atiende', 4294967295]
  ];
  for (const [table, field, badId] of foreignKeys) {
    const module = modules.find(m => m.table === table);
    const body = { ...createBodies[table], [field]: badId };
    if (body.nombre) body.nombre = `Sin FK ${tag}`;
    if (body.email) body.email = `fk.${tag}@example.test`;
    await request(table, `Rechazar referencia inexistente: ${field}`, 'POST', `/api/${module.path}`, body, 400);
  }
  for (const table of ['roles', 'zonas_origen', 'productores']) {
    const module = modules.find(m => m.table === table);
    await request(table, 'Respetar ON DELETE RESTRICT', 'DELETE', resourcePath(module, refs[table]), undefined, 409);
  }

  const zone = modules.find(m => m.table === 'zonas_origen');
  await request(zone.table, 'Validar altitudes sobre PATCH parcial', 'PATCH', resourcePath(zone, refs[zone.table]), { altitud_min: 2200 }, 400);
  const grain = modules.find(m => m.table === 'granos');
  for (const body of [{ precio_kg: 0 }, { stock_kg: -1 }, { precio_kg: 1.234 }, { puntaje_taza: 100.1 }, { precio_kg: '40' }]) {
    await request(grain.table, 'Validar precio, stock, precisión y tipo', 'PATCH', resourcePath(grain, refs[grain.table]), body, 400);
  }
  const user = modules.find(m => m.table === 'usuarios');
  await request(user.table, 'Rechazar correo inválido', 'PATCH', resourcePath(user, refs.usuarios), { email: 'sin-correo' }, 400);
  await request(user.table, 'Rechazar escritura directa del hash', 'PATCH', resourcePath(user, refs.usuarios), { password_hash: 'no-permitido' }, 400);
  await request(user.table, 'Rechazar fecha de registro manual', 'PATCH', resourcePath(user, refs.usuarios), { fecha_registro: '2026-11-23 10:00:00' }, 400);
  await request(user.table, 'Rechazar contraseña corta', 'PATCH', resourcePath(user, refs.usuarios), { password: 'corta' }, 400);
  let [[storedUser]] = await pool.execute('SELECT password_hash FROM usuarios WHERE id_usuario = ?', [refs.usuarios.id_usuario]);
  const firstMatches = await bcrypt.compare(createBodies.usuarios.password, storedUser.password_hash);
  check('usuarios: contraseña creada almacenada como bcrypt verificable', () => assert.equal(firstMatches, true));
  const newPassword = `NuevaDemo_${tag}!`;
  await request(user.table, 'Actualizar contraseña sin exponerla', 'PATCH', resourcePath(user, refs.usuarios), { password: newPassword }, 200);
  [[storedUser]] = await pool.execute('SELECT password_hash FROM usuarios WHERE id_usuario = ?', [refs.usuarios.id_usuario]);
  const changedMatches = await bcrypt.compare(newPassword, storedUser.password_hash);
  check('usuarios: nueva contraseña almacenada como bcrypt verificable', () => assert.equal(changedMatches, true));

  const message = modules.find(m => m.table === 'mensajes_contacto');
  await request(message.table, 'Rechazar Respondido sin respuesta completa', 'POST', `/api/${message.path}`, { ...createBodies.mensajes_contacto, estado: 'Respondido' }, 400);
  await request(message.table, 'Rechazar borrar respuesta de mensaje respondido', 'PATCH', resourcePath(message, refs.mensajes_contacto), { respuesta: null }, 400);
  const cafe = modules.find(m => m.table === 'cafeterias_aliadas');
  await request(cafe.table, 'Rechazar fecha inexistente', 'PATCH', resourcePath(cafe, refs.cafeterias_aliadas), { fecha_alianza: '2026-02-30' }, 400);
  const link = modules.find(m => m.table === 'cafeteria_grano');
  await request(link.table, 'Mantener clave compuesta inmutable', 'PATCH', resourcePath(link, refs.cafeteria_grano), { id_grano: 1 }, 400);
  await request('roles', 'Rechazar campo desconocido', 'POST', '/api/roles', { nombre: `Campo ${tag}`, otro: true }, 400);
  await request('roles', 'Rechazar ID con expresión SQL', 'GET', '/api/roles/1%20OR%201%3D1', undefined, 400);
  await request('roles', 'Rechazar parámetro de consulta desconocido', 'GET', '/api/roles?sort=nombre', undefined, 400);
  const literal = "O'Reilly; DROP TABLE roles; --";
  const escaped = await request('roles', 'Guardar comillas como texto mediante parámetros', 'PATCH', resourcePath(modules[0], refs.roles), { descripcion: literal }, 200);
  check('Consultas parametrizadas conservan el texto literal', () => assert.equal(escaped.data.descripcion, literal));
  await request('sistema', 'Rechazar JSON mal formado', 'POST', '/api/roles', '{"nombre":', 400, { raw: true });
  await request('sistema', 'Rechazar Content-Type incorrecto', 'POST', '/api/roles', '{}', 415, { raw: true, contentType: 'text/plain' });
  await request('sistema', 'Rechazar cuerpo excesivo', 'POST', '/api/roles', { nombre: 'x'.repeat(34000) }, 413);
  // Evitar incluir 34 KB de texto irrelevante en las evidencias.
  report.results.at(-1).request.body = { nombre: '[34 000 caracteres: prueba del límite de cuerpo]' };
  await request('sistema', 'Ruta inexistente', 'GET', '/api/no-existe', undefined, 404);

  // DELETE individual de la relación; luego volver a crearla para probar CASCADE.
  await remove(link);
  await request(link.table, 'Preparar comprobación CASCADE de grano', 'POST', `/api/${link.path}`, createBodies.cafeteria_grano, 201);
  deleted.delete(link.table);
  await remove(grain);
  await request(link.table, 'ON DELETE CASCADE desde granos', 'GET', resourcePath(link, refs.cafeteria_grano), undefined, 404);
  deleted.add(link.table);

  // SET NULL mantiene la cafetería y el mensaje al eliminar su usuario.
  await remove(user);
  for (const [module, foreignField] of [[cafe, 'id_usuario_resp'], [message, 'id_usuario_atiende']]) {
    const remaining = await request(module.table, 'Comprobar ON DELETE SET NULL', 'GET', resourcePath(module, refs[module.table]), undefined, 200);
    check(`${module.table}: conserva el registro con referencia nula`, () => assert.equal(remaining.data[foreignField], null));
  }

  // Comprobar también CASCADE desde cafeterías sin modificar el grano de muestra.
  if (baseline.granos.length) {
    extraLink = { id_cafeteria: refs.cafeterias_aliadas.id_cafeteria, id_grano: baseline.granos[0].id_grano, fecha_inicio: '2026-11-23' };
    await request(link.table, 'Preparar comprobación CASCADE de cafetería', 'POST', `/api/${link.path}`, extraLink, 201);
  }
  await remove(cafe);
  if (extraLink) {
    await request(link.table, 'ON DELETE CASCADE desde cafeterías', 'GET', resourcePath(link, extraLink), undefined, 404);
    extraLink = null;
  }
  for (const module of [...modules].reverse()) {
    if (!deleted.has(module.table)) await remove(module);
  }
  const after = await snapshot();
  check('Los registros originales permanecen intactos; se retiraron todos los datos temporales', () => assert.deepEqual(after, baseline));
  check('Hay exactamente dos evidencias seleccionadas por cada uno de los nueve módulos', () => {
    assert.equal(report.selectedEvidence.length, 18);
    for (const module of modules) {
      assert.equal(report.results.filter(r => r.table === module.table && report.selectedEvidence.includes(r.id)).length, 2);
    }
  });
  report.crudCoverage = modules.map(module => ({
    table: module.table,
    operations: ['Crear registro', 'Listar registros', 'Consultar por identificador', 'Actualizar parcialmente', 'Eliminar registro'].map(title => ({
      operation: title,
      passed: report.results.some(r => r.table === module.table && r.title === title && r.passed)
    }))
  }));
  check('Las 45 operaciones CRUD están verificadas', () => {
    assert.equal(report.crudCoverage.flatMap(m => m.operations).filter(o => o.passed).length, 45);
  });
}

async function finish() {
  // Si una aserción falla, retirar únicamente IDs que creó esta ejecución.
  if (baseline) {
    if (extraLink) await pool.execute('DELETE FROM cafeteria_grano WHERE id_cafeteria = ? AND id_grano = ?', [extraLink.id_cafeteria, extraLink.id_grano]);
    for (const module of [...modules].reverse()) {
      const row = refs[module.table];
      if (!row || deleted.has(module.table)) continue;
      if (module.id) await pool.execute(`DELETE FROM ${module.table} WHERE ${module.id} = ?`, [row[module.id]]);
      else await pool.execute('DELETE FROM cafeteria_grano WHERE id_cafeteria = ? AND id_grano = ?', [row.id_cafeteria, row.id_grano]);
    }
  }
  if (server) await new Promise(resolve => server.close(resolve));
  await pool.end();
  report.finishedAt = new Date().toISOString();
  report.summary = {
    passed: !failure && report.results.every(r => r.passed) && report.checks.every(c => c.passed),
    httpRequests: report.results.length,
    passedRequests: report.results.filter(r => r.passed).length,
    assertions: report.checks.length,
    passedAssertions: report.checks.filter(c => c.passed).length,
    crudOperations: report.crudCoverage?.flatMap(m => m.operations).filter(o => o.passed).length || 0,
    selectedEvidence: report.selectedEvidence.length
  };
  if (failure) report.failure = failure.message;
  const output = path.resolve(__dirname, '../evidencias/resultados-api.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report.summary, null, 2));
  console.log('Evidencia: evidencias/resultados-api.json');
}

main().catch(error => {
  failure = error;
  console.error('Prueba interrumpida:', error.message);
  process.exitCode = 1;
}).finally(async () => {
  try { await finish(); }
  catch (error) { console.error('No se pudo completar la limpieza de los datos de prueba.', error.code || error.name); process.exitCode = 1; }
});
