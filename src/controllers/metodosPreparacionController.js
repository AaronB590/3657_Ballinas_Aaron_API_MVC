'use strict';

const Model = require('../models/metodosPreparacionModel');
const AppError = require('../utils/AppError');
const { validateBody, validateId, validatePagination } = require('../validators');

async function listar(req, res) {
  const { limit, offset } = validatePagination(req.query);
  const rows = await Model.listar({ limit, offset });
  return res.status(200).json({
    success: true,
    message: 'Consulta realizada correctamente.',
    data: rows,
    pagination: { limit, offset, count: rows.length },
  });
}

async function obtenerPorId(req, res) {
  const id = validateId(req.params.id, 65535, 'id_metodo');
  const row = await Model.obtenerPorId(id);
  if (!row) throw new AppError(404, 'Método de preparación no encontrado.');
  return res.status(200).json({ success: true, message: 'Registro encontrado.', data: row });
}

async function crear(req, res) {
  const data = validateBody('metodos_preparacion', req.body, { partial: false });
  const row = await Model.crear(data);
  return res
    .location(`/api/metodos-preparacion/${row.id_metodo}`)
    .status(201)
    .json({ success: true, message: 'Registro creado correctamente.', data: row });
}

async function actualizar(req, res) {
  const id = validateId(req.params.id, 65535, 'id_metodo');
  const current = await Model.obtenerPorId(id);
  if (!current) throw new AppError(404, 'Método de preparación no encontrado.');
  const data = validateBody('metodos_preparacion', req.body, { partial: true, current });
  await Model.actualizar(id, data);
  const row = await Model.obtenerPorId(id);
  if (!row) throw new AppError(404, 'Método de preparación no encontrado.');
  return res.status(200).json({
    success: true,
    message: 'Registro actualizado correctamente.',
    data: row,
  });
}

async function eliminar(req, res) {
  const id = validateId(req.params.id, 65535, 'id_metodo');
  const affectedRows = await Model.eliminar(id);
  if (affectedRows === 0) throw new AppError(404, 'Método de preparación no encontrado.');
  return res.status(200).json({
    success: true,
    message: 'Registro eliminado correctamente.',
    data: { id_metodo: id },
  });
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
