'use strict';

const pool = require('../config/database');

// Esta tabla tiene una clave primaria compuesta; no existe un ID independiente.
const SELECT_COLUMNS = 'id_cafeteria, id_grano, fecha_inicio';

async function listar({ limit, offset }) {
  const [rows] = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM cafeteria_grano
     ORDER BY id_cafeteria, id_grano LIMIT ? OFFSET ?`,
    [limit, offset],
  );
  return rows;
}

async function obtenerPorId(idCafeteria, idGrano) {
  const [rows] = await pool.execute(
    `SELECT ${SELECT_COLUMNS} FROM cafeteria_grano
     WHERE id_cafeteria = ? AND id_grano = ?`,
    [idCafeteria, idGrano],
  );
  return rows[0] || null;
}

async function crear(data) {
  await pool.execute(
    'INSERT INTO cafeteria_grano (id_cafeteria, id_grano, fecha_inicio) VALUES (?, ?, ?)',
    [data.id_cafeteria, data.id_grano, data.fecha_inicio],
  );
  return obtenerPorId(data.id_cafeteria, data.id_grano);
}

async function actualizar(idCafeteria, idGrano, data) {
  // La fecha puede cambiar; las claves que identifican la relación permanecen fijas.
  const [result] = await pool.execute(
    'UPDATE cafeteria_grano SET fecha_inicio = ? WHERE id_cafeteria = ? AND id_grano = ?',
    [data.fecha_inicio, idCafeteria, idGrano],
  );
  return result.affectedRows;
}

async function eliminar(idCafeteria, idGrano) {
  const [result] = await pool.execute(
    'DELETE FROM cafeteria_grano WHERE id_cafeteria = ? AND id_grano = ?',
    [idCafeteria, idGrano],
  );
  return result.affectedRows;
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
