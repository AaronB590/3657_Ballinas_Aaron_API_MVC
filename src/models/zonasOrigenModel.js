'use strict';

const pool = require('../config/database');
const { buildInsert, buildUpdate } = require('./queryUtils');

const WRITABLE_FIELDS = ['nombre', 'categoria', 'region', 'altitud_min', 'altitud_max', 'perfil_sabor', 'descripcion', 'activo'];
const SELECT_COLUMNS = 'id_zona, nombre, categoria, region, altitud_min, altitud_max, perfil_sabor, descripcion, activo';

async function listar({ limit, offset }) {
  // mysql2 escapa los valores; el límite y el desplazamiento ya son enteros validados.
  const [rows] = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM zonas_origen ORDER BY id_zona LIMIT ? OFFSET ?`,
    [limit, offset],
  );
  return rows;
}

async function obtenerPorId(id) {
  const [rows] = await pool.execute(
    `SELECT ${SELECT_COLUMNS} FROM zonas_origen WHERE id_zona = ?`,
    [id],
  );
  return rows[0] || null;
}

async function crear(data) {
  const { columns, placeholders, values } = buildInsert(data, WRITABLE_FIELDS);
  const [result] = await pool.execute(
    `INSERT INTO zonas_origen (${columns}) VALUES (${placeholders})`,
    values,
  );
  return obtenerPorId(result.insertId);
}

async function actualizar(id, data) {
  const { assignments, values } = buildUpdate(data, WRITABLE_FIELDS);
  const [result] = await pool.execute(
    `UPDATE zonas_origen SET ${assignments} WHERE id_zona = ?`,
    [...values, id],
  );
  return result.affectedRows;
}

async function eliminar(id) {
  const [result] = await pool.execute('DELETE FROM zonas_origen WHERE id_zona = ?', [id]);
  return result.affectedRows;
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
