'use strict';

const pool = require('../config/database');
const { buildInsert, buildUpdate } = require('./queryUtils');

const WRITABLE_FIELDS = ['id_productor', 'nombre', 'variedad', 'proceso', 'tueste', 'puntaje_taza', 'precio_kg', 'stock_kg', 'disponible'];
const SELECT_COLUMNS = 'id_grano, id_productor, nombre, variedad, proceso, tueste, puntaje_taza, precio_kg, stock_kg, disponible';

async function listar({ limit, offset }) {
  // mysql2 escapa los valores; el límite y el desplazamiento ya son enteros validados.
  const [rows] = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM granos ORDER BY id_grano LIMIT ? OFFSET ?`,
    [limit, offset],
  );
  return rows;
}

async function obtenerPorId(id) {
  const [rows] = await pool.execute(
    `SELECT ${SELECT_COLUMNS} FROM granos WHERE id_grano = ?`,
    [id],
  );
  return rows[0] || null;
}

async function crear(data) {
  const { columns, placeholders, values } = buildInsert(data, WRITABLE_FIELDS);
  const [result] = await pool.execute(
    `INSERT INTO granos (${columns}) VALUES (${placeholders})`,
    values,
  );
  return obtenerPorId(result.insertId);
}

async function actualizar(id, data) {
  const { assignments, values } = buildUpdate(data, WRITABLE_FIELDS);
  const [result] = await pool.execute(
    `UPDATE granos SET ${assignments} WHERE id_grano = ?`,
    [...values, id],
  );
  return result.affectedRows;
}

async function eliminar(id) {
  const [result] = await pool.execute('DELETE FROM granos WHERE id_grano = ?', [id]);
  return result.affectedRows;
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
