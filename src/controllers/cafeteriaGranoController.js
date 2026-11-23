'use strict';

const Model = require('../models/cafeteriaGranoModel');
const AppError = require('../utils/AppError');
const { validateBody, validateId, validatePagination } = require('../validators');

function obtenerClaves(params) {
  return {
    idCafeteria: validateId(params.id_cafeteria, 4294967295, 'id_cafeteria'),
    idGrano: validateId(params.id_grano, 4294967295, 'id_grano'),
  };
}

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
  const { idCafeteria, idGrano } = obtenerClaves(req.params);
  const row = await Model.obtenerPorId(idCafeteria, idGrano);
  if (!row) throw new AppError(404, 'Relación cafetería-grano no encontrada.');
  return res.status(200).json({ success: true, message: 'Registro encontrado.', data: row });
}

async function crear(req, res) {
  const data = validateBody('cafeteria_grano', req.body, { partial: false });
  const row = await Model.crear(data);
  return res
    .location(`/api/cafeteria-grano/${row.id_cafeteria}/${row.id_grano}`)
    .status(201)
    .json({ success: true, message: 'Relación creada correctamente.', data: row });
}

async function actualizar(req, res) {
  const { idCafeteria, idGrano } = obtenerClaves(req.params);
  const current = await Model.obtenerPorId(idCafeteria, idGrano);
  if (!current) throw new AppError(404, 'Relación cafetería-grano no encontrada.');
  const data = validateBody('cafeteria_grano', req.body, { partial: true, current });
  await Model.actualizar(idCafeteria, idGrano, data);
  const row = await Model.obtenerPorId(idCafeteria, idGrano);
  if (!row) throw new AppError(404, 'Relación cafetería-grano no encontrada.');
  return res.status(200).json({
    success: true,
    message: 'Relación actualizada correctamente.',
    data: row,
  });
}

async function eliminar(req, res) {
  const { idCafeteria, idGrano } = obtenerClaves(req.params);
  const affectedRows = await Model.eliminar(idCafeteria, idGrano);
  if (affectedRows === 0) throw new AppError(404, 'Relación cafetería-grano no encontrada.');
  return res.status(200).json({
    success: true,
    message: 'Relación eliminada correctamente.',
    data: { id_cafeteria: idCafeteria, id_grano: idGrano },
  });
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
