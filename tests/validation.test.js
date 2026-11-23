'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateBody, validateId, validatePagination } = require('../src/validators');

function rejectsInput(fn, field) {
  assert.throws(fn, error => {
    assert.equal(error.statusCode, 400);
    if (field) assert.ok(error.details.some(detail => detail.field === field));
    return true;
  });
}

const grain = {
  id_productor: 1, nombre: 'Café de prueba', variedad: 'Typica',
  proceso: 'Lavado', tueste: 'Medio', puntaje_taza: 86.5, precio_kg: 78.36
};

test('Todas las tablas admiten un cuerpo mínimo válido sin sustituir los defaults SQL', () => {
  const cases = {
    roles: { nombre: 'Rol de prueba' },
    usuarios: { id_rol: 1, nombre: 'Persona de prueba', email: 'demo@example.test', password: 'SoloPrueba2026!' },
    zonas_origen: { nombre: 'Zona de prueba', categoria: 'Orgánico', region: 'Cusco', altitud_min: 1200, altitud_max: 1800, perfil_sabor: 'Frutal' },
    productores: { id_zona: 1, nombre: 'Productor de prueba' },
    granos: grain,
    metodos_preparacion: { nombre: 'Método de prueba', descripcion: 'Inmersión', proporcion: '1:15', temperatura_c: 94, tiempo_seg: 240, molienda: 'Gruesa', dificultad: 'Fácil' },
    cafeterias_aliadas: { nombre: 'Cafetería de prueba', ciudad: 'Lima', direccion: 'Calle de prueba 1', fecha_alianza: '2026-11-23' },
    cafeteria_grano: { id_cafeteria: 1, id_grano: 1, fecha_inicio: '2026-11-23' },
    mensajes_contacto: { nombre: 'Persona de prueba', email: 'demo@example.test', mensaje: 'Consulta de prueba' }
  };
  for (const [table, body] of Object.entries(cases)) {
    assert.deepEqual(validateBody(table, body), body, table);
  }
});

test('POST rechaza campos obligatorios ausentes y null en campos no nullable', () => {
  rejectsInput(() => validateBody('roles', {}), 'nombre');
  rejectsInput(() => validateBody('roles', { nombre: null }), 'nombre');
  rejectsInput(() => validateBody('usuarios', { id_rol: 1, nombre: 'Demo', email: 'demo@example.test' }), 'password');
});

test('El cuerpo debe ser un objeto JSON, no null, array o texto', () => {
  for (const body of [null, undefined, [], 'texto', 2]) {
    rejectsInput(() => validateBody('roles', body), 'body');
  }
});

test('Campos desconocidos, hashes y fechas autogeneradas son rechazados', () => {
  rejectsInput(() => validateBody('roles', { nombre: 'Demo', admin: true }), 'admin');
  rejectsInput(() => validateBody('usuarios', { password_hash: 'abc' }, { partial: true }), 'password_hash');
  rejectsInput(() => validateBody('usuarios', { fecha_registro: '2026-01-01 10:00:00' }, { partial: true }), 'fecha_registro');
  rejectsInput(() => validateBody('mensajes_contacto', { fecha_envio: '2026-01-01 10:00:00' }, { partial: true }), 'fecha_envio');
  rejectsInput(() => validateBody('roles', JSON.parse('{"nombre":"Demo","__proto__":{"admin":true}}')), '__proto__');
});

test('PATCH exige algún campo y conserva los campos omitidos', () => {
  rejectsInput(() => validateBody('roles', {}, { partial: true }), 'body');
  const current = { id_rol: 1, nombre: 'Anterior', descripcion: 'Conservar' };
  assert.deepEqual(validateBody('roles', { nombre: 'Nuevo' }, { partial: true, current }), { nombre: 'Nuevo' });
  assert.equal(current.nombre, 'Anterior');
});

test('Se recorta texto y se permite null únicamente en campos nullable', () => {
  assert.deepEqual(validateBody('roles', { nombre: '  Editor  ', descripcion: null }), { nombre: 'Editor', descripcion: null });
  rejectsInput(() => validateBody('roles', { nombre: '  ' }), 'nombre');
  rejectsInput(() => validateBody('roles', { nombre: 'Demo', descripcion: '  ' }), 'descripcion');
});

test('La longitud de texto se mide por caracteres Unicode', () => {
  assert.equal(validateBody('roles', { nombre: '☕'.repeat(30) }).nombre.length, 30);
  assert.equal(Array.from(validateBody('roles', { nombre: '😀'.repeat(30) }).nombre).length, 30);
  rejectsInput(() => validateBody('roles', { nombre: '😀'.repeat(31) }), 'nombre');
});

test('Los campos numéricos JSON no aceptan texto ni valores fuera del dominio', () => {
  rejectsInput(() => validateBody('productores', { id_zona: '1', nombre: 'Demo' }), 'id_zona');
  rejectsInput(() => validateBody('productores', { id_zona: 65536, nombre: 'Demo' }), 'id_zona');
  rejectsInput(() => validateBody('productores', { id_zona: 1.5, nombre: 'Demo' }), 'id_zona');
  rejectsInput(() => validateBody('granos', { ...grain, precio_kg: 0 }), 'precio_kg');
  rejectsInput(() => validateBody('granos', { ...grain, stock_kg: -1 }), 'stock_kg');
  rejectsInput(() => validateBody('granos', { ...grain, precio_kg: Infinity }), 'precio_kg');
});

test('Los decimales respetan precisión y máximo de la columna sin falsos rechazos binarios', () => {
  for (const price of [0.01, 78.36, 999999.99]) {
    assert.equal(validateBody('granos', { ...grain, precio_kg: price }).precio_kg, price);
  }
  for (const price of [1.001, 1e-7, 1000000]) {
    rejectsInput(() => validateBody('granos', { ...grain, precio_kg: price }), 'precio_kg');
  }
  rejectsInput(() => validateBody('granos', { ...grain, puntaje_taza: 86.55 }), 'puntaje_taza');
  rejectsInput(() => validateBody('granos', { ...grain, puntaje_taza: 100.1 }), 'puntaje_taza');
});

test('Flags aceptan booleanos o números0/1, nunca strings', () => {
  assert.deepEqual(validateBody('productores', { activo: true, certificacion_organica: false }, { partial: true }), { activo: 1, certificacion_organica: 0 });
  for (const flag of ['1', 'true', 2, null]) {
    rejectsInput(() => validateBody('productores', { activo: flag }, { partial: true }), 'activo');
  }
});

test('Los ENUM y correos se validan antes de SQL', () => {
  rejectsInput(() => validateBody('granos', { ...grain, proceso: 'Secado' }), 'proceso');
  rejectsInput(() => validateBody('granos', { ...grain, tueste: 'medio' }), 'tueste');
  rejectsInput(() => validateBody('productores', { email: 'sin-arroba.com' }, { partial: true }), 'email');
  rejectsInput(() => validateBody('productores', { email: 'dos@@example.test' }, { partial: true }), 'email');
});

test('Fechas rechazan días inexistentes, horas inválidas y formatos ambiguos', () => {
  for (const date of ['2026-02-29', '2026-02-30', '2026-04-31', '2026-13-01', '0999-01-01', '23/11/2026']) {
    rejectsInput(() => validateBody('cafeteria_grano', { fecha_inicio: date }, { partial: true }), 'fecha_inicio');
  }
  assert.deepEqual(validateBody('cafeteria_grano', { fecha_inicio: '2028-02-29' }, { partial: true }), { fecha_inicio: '2028-02-29' });
  for (const datetime of ['2026-02-30 12:00:00', '2026-11-23 24:00:00', '2026-11-23 12:60:00', '2026-11-23T12:00:00Z']) {
    rejectsInput(() => validateBody('mensajes_contacto', { fecha_respuesta: datetime }, { partial: true }), 'fecha_respuesta');
  }
});

test('Altitud se comprueba contra el registro actual en una actualización parcial', () => {
  const current = { altitud_min: 1200, altitud_max: 1800 };
  rejectsInput(() => validateBody('zonas_origen', { altitud_min: 2000 }, { partial: true, current }), 'altitud_max');
  rejectsInput(() => validateBody('zonas_origen', { altitud_max: 1000 }, { partial: true, current }), 'altitud_max');
  assert.deepEqual(validateBody('zonas_origen', { altitud_min: 1800 }, { partial: true, current }), { altitud_min: 1800 });
});

test('Respondido exige respuesta y fecha; un PATCH puede reutilizar las existentes', () => {
  rejectsInput(() => validateBody('mensajes_contacto', { estado: 'Respondido' }, { partial: true }), 'respuesta');
  const current = { estado: 'Respondido', respuesta: 'Respuesta guardada', fecha_respuesta: '2026-11-23 12:30:00' };
  rejectsInput(() => validateBody('mensajes_contacto', { respuesta: null }, { partial: true, current }), 'respuesta');
  rejectsInput(() => validateBody('mensajes_contacto', { fecha_respuesta: null }, { partial: true, current }), 'fecha_respuesta');
  assert.deepEqual(validateBody('mensajes_contacto', { respuesta: 'Respuesta actualizada' }, { partial: true, current }), { respuesta: 'Respuesta actualizada' });
  assert.deepEqual(validateBody('mensajes_contacto', { estado: 'Nuevo', respuesta: null, fecha_respuesta: null }, { partial: true, current }), { estado: 'Nuevo', respuesta: null, fecha_respuesta: null });
});

test('Las dos claves de cafeteria_grano son inmutables en PATCH', () => {
  rejectsInput(() => validateBody('cafeteria_grano', { id_cafeteria: 2 }, { partial: true }), 'id_cafeteria');
  rejectsInput(() => validateBody('cafeteria_grano', { id_grano: 2 }, { partial: true }), 'id_grano');
});

test('La contraseña conserva espacios y valida el límite UTF-8 de bcrypt', () => {
  assert.deepEqual(validateBody('usuarios', { password: '  ClaveDemo2026  ' }, { partial: true }), { password: '  ClaveDemo2026  ' });
  rejectsInput(() => validateBody('usuarios', { password: 'corta' }, { partial: true }), 'password');
  rejectsInput(() => validateBody('usuarios', { password: ' '.repeat(8) }, { partial: true }), 'password');
  rejectsInput(() => validateBody('usuarios', { password: '😀'.repeat(19) }, { partial: true }), 'password');
  assert.equal(validateBody('usuarios', { password: '😀'.repeat(18) }, { partial: true }).password, '😀'.repeat(18));
});

test('IDs rechazan valores malformados, listas, inyección y overflow', () => {
  for (const value of ['', ' ', '1abc', '-1', '+1', '1.0', '1e1', '01', '0', ['1'], '4294967296', '1 OR 1=1']) {
    rejectsInput(() => validateId(value), 'id');
  }
  assert.equal(validateId('4294967295'), 4294967295);
  assert.equal(validateId('255', 255, 'id_rol'), 255);
  rejectsInput(() => validateId('256', 255, 'id_rol'), 'id_rol');
});

test('La paginación tiene límites explícitos y no admite parámetros ambiguos', () => {
  assert.deepEqual(validatePagination({}), { limit: 20, offset: 0 });
  assert.deepEqual(validatePagination({ limit: '100', offset: '1000000' }), { limit: 100, offset: 1000000 });
  for (const query of [{ limit: '101' }, { limit: '0' }, { limit: ['10', '20'] }, { offset: '-1' }, { offset: '1000001' }]) {
    rejectsInput(() => validatePagination(query));
  }
  rejectsInput(() => validatePagination({ order: 'DROP TABLE usuarios' }), 'order');
});
