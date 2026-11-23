'use strict';

const Model = require('../models/zonasOrigenModel');
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
  const id = validateId(req.params.id, 65535, 'id_zona');
  const row = await Model.obtenerPorId(id);
  if (!row) throw new AppError(404, 'Zona de origen no encontrada.');
  return res.status(200).json({ success: true, message: 'Registro encontrado.', data: row });
}

async function crear(req, res) {
  const data = validateBody('zonas_origen', req.body, { partial: false });
  const row = await Model.crear(data);
  return res
    .location(`/api/zonas-origen/${row.id_zona}`)
    .status(201)
    .json({ success: true, message: 'Registro creado correctamente.', data: row });
}

async function actualizar(req, res) {
  const id = validateId(req.params.id, 65535, 'id_zona');
  const current = await Model.obtenerPorId(id);
  if (!current) throw new AppError(404, 'Zona de origen no encontrada.');
  const data = validateBody('zonas_origen', req.body, { partial: true, current });
  await Model.actualizar(id, data);
  const row = await Model.obtenerPorId(id);
  if (!row) throw new AppError(404, 'Zona de origen no encontrada.');
  return res.status(200).json({
    success: true,
    message: 'Registro actualizado correctamente.',
    data: row,
  });
}

async function eliminar(req, res) {
  const id = validateId(req.params.id, 65535, 'id_zona');
  const affectedRows = await Model.eliminar(id);
  if (affectedRows === 0) throw new AppError(404, 'Zona de origen no encontrada.');
  return res.status(200).json({
    success: true,
    message: 'Registro eliminado correctamente.',
    data: { id_zona: id },
  });
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
