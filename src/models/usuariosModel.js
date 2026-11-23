'use strict';

const pool = require('../config/database');
const { buildInsert, buildUpdate } = require('./queryUtils');

const WRITABLE_FIELDS = ['id_rol', 'nombre', 'email', 'password_hash', 'activo'];
// Las consultas públicas excluyen password_hash de forma explícita.
const SELECT_COLUMNS = 'id_usuario, id_rol, nombre, email, activo, fecha_registro';

async function listar({ limit, offset }) {
  // mysql2 escapa los valores; el límite y el desplazamiento ya son enteros validados.
  const [rows] = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM usuarios ORDER BY id_usuario LIMIT ? OFFSET ?`,
    [limit, offset],
  );
  return rows;
}

async function obtenerPorId(id) {
  const [rows] = await pool.execute(
    `SELECT ${SELECT_COLUMNS} FROM usuarios WHERE id_usuario = ?`,
    [id],
  );
  return rows[0] || null;
}

async function crear(data) {
  const { columns, placeholders, values } = buildInsert(data, WRITABLE_FIELDS);
  const [result] = await pool.execute(
    `INSERT INTO usuarios (${columns}) VALUES (${placeholders})`,
    values,
  );
  return obtenerPorId(result.insertId);
}

async function actualizar(id, data) {
  const { assignments, values } = buildUpdate(data, WRITABLE_FIELDS);
  const [result] = await pool.execute(
    `UPDATE usuarios SET ${assignments} WHERE id_usuario = ?`,
    [...values, id],
  );
  return result.affectedRows;
}

async function eliminar(id) {
  const [result] = await pool.execute('DELETE FROM usuarios WHERE id_usuario = ?', [id]);
  return result.affectedRows;
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
