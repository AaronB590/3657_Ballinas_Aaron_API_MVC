'use strict';

const pool = require('../config/database');
const { buildInsert, buildUpdate } = require('./queryUtils');

const WRITABLE_FIELDS = ['nombre', 'descripcion'];
const SELECT_COLUMNS = 'id_rol, nombre, descripcion';

async function listar({ limit, offset }) {
  // mysql2 escapa los valores; el límite y el desplazamiento ya son enteros validados.
  const [rows] = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM roles ORDER BY id_rol LIMIT ? OFFSET ?`,
    [limit, offset],
  );
  return rows;
}

async function obtenerPorId(id) {
  const [rows] = await pool.execute(
    `SELECT ${SELECT_COLUMNS} FROM roles WHERE id_rol = ?`,
    [id],
  );
  return rows[0] || null;
}

async function crear(data) {
  const { columns, placeholders, values } = buildInsert(data, WRITABLE_FIELDS);
  const [result] = await pool.execute(
    `INSERT INTO roles (${columns}) VALUES (${placeholders})`,
    values,
  );
  return obtenerPorId(result.insertId);
}

async function actualizar(id, data) {
  const { assignments, values } = buildUpdate(data, WRITABLE_FIELDS);
  const [result] = await pool.execute(
    `UPDATE roles SET ${assignments} WHERE id_rol = ?`,
    [...values, id],
  );
  return result.affectedRows;
}

async function eliminar(id) {
  const [result] = await pool.execute('DELETE FROM roles WHERE id_rol = ?', [id]);
  return result.affectedRows;
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
