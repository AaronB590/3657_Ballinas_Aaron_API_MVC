'use strict';

const Model = require('../models/usuariosModel');
const AppError = require('../utils/AppError');
const { validateBody, validateId, validatePagination } = require('../validators');
const { hashPassword } = require('../utils/password');

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
  const id = validateId(req.params.id, 4294967295, 'id_usuario');
  const row = await Model.obtenerPorId(id);
  if (!row) throw new AppError(404, 'Usuario no encontrado.');
  return res.status(200).json({ success: true, message: 'Registro encontrado.', data: row });
}

async function crear(req, res) {
  const data = validateBody('usuarios', req.body, { partial: false });
  data.password_hash = await hashPassword(data.password);
  delete data.password;
  const row = await Model.crear(data);
  return res
    .location(`/api/usuarios/${row.id_usuario}`)
    .status(201)
    .json({ success: true, message: 'Registro creado correctamente.', data: row });
}

async function actualizar(req, res) {
  const id = validateId(req.params.id, 4294967295, 'id_usuario');
  const current = await Model.obtenerPorId(id);
  if (!current) throw new AppError(404, 'Usuario no encontrado.');
  const data = validateBody('usuarios', req.body, { partial: true, current });
  if (Object.hasOwn(data, 'password')) {
    data.password_hash = await hashPassword(data.password);
    delete data.password;
  }
  await Model.actualizar(id, data);
  const row = await Model.obtenerPorId(id);
  if (!row) throw new AppError(404, 'Usuario no encontrado.');
  return res.status(200).json({
    success: true,
    message: 'Registro actualizado correctamente.',
    data: row,
  });
}

async function eliminar(req, res) {
  const id = validateId(req.params.id, 4294967295, 'id_usuario');
  const affectedRows = await Model.eliminar(id);
  if (affectedRows === 0) throw new AppError(404, 'Usuario no encontrado.');
  return res.status(200).json({
    success: true,
    message: 'Registro eliminado correctamente.',
    data: { id_usuario: id },
  });
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
