'use strict';

const AppError = require('../utils/AppError');

const dbErrors = {
  ER_DUP_ENTRY: [409, 'Ya existe un registro con ese valor único o con esa relación.'],
  ER_NO_REFERENCED_ROW_2: [400, 'La referencia indicada no existe. Revisa los identificadores relacionados.'],
  ER_ROW_IS_REFERENCED_2: [409, 'No se puede eliminar el registro porque otros registros dependen de él.'],
  ER_CHECK_CONSTRAINT_VIOLATED: [400, 'Los datos no cumplen una restricción de la base de datos.'],
  ER_CONSTRAINT_FAILED: [400, 'Los datos no cumplen una restricción de la base de datos.'],
  ER_BAD_NULL_ERROR: [400, 'Un campo obligatorio no puede ser nulo.'],
  ER_DATA_TOO_LONG: [400, 'Un campo supera la longitud permitida.'],
  ER_WARN_DATA_OUT_OF_RANGE: [400, 'Un valor numérico está fuera del rango permitido.'],
  ER_TRUNCATED_WRONG_VALUE_FOR_FIELD: [400, 'El tipo de uno de los datos no es válido.'],
  WARN_DATA_TRUNCATED: [400, 'Un valor no está permitido para ese campo.']
};

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  let status = 500;
  let message = 'Ocurrió un error interno. Intenta nuevamente o contacta al responsable del sistema.';
  let details;

  if (error instanceof AppError) {
    status = error.statusCode;
    message = error.message;
    details = error.details;
  } else if (error.type === 'entity.parse.failed') {
    status = 400;
    message = 'El cuerpo contiene JSON inválido. Revisa comillas, comas y llaves.';
  } else if (error.type === 'entity.too.large') {
    status = 413;
    message = 'El cuerpo de la solicitud supera el máximo de 32 KB.';
  } else if (error.type === 'charset.unsupported' || error.type === 'encoding.unsupported') {
    status = 415;
    message = 'Utiliza JSON con codificación UTF-8.';
  } else if (error instanceof URIError) {
    status = 400;
    message = 'La dirección de la solicitud contiene caracteres inválidos.';
  } else if (dbErrors[error.code]) {
    [status, message] = dbErrors[error.code];
  }

  if (status >= 500) {
    // Registrar sólo el código técnico: nunca SQL, cuerpo, clave o cadena de conexión.
    console.error('[API_ERROR]', error.code || error.name || 'UNKNOWN_ERROR');
  }

  const body = { success: false, message };
  if (details) body.errors = details;
  res.status(status).json(body);
}

module.exports = errorHandler;
