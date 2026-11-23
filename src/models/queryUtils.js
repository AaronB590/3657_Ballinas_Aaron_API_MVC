'use strict';

// Solo se usan columnas definidas por cada modelo, nunca nombres recibidos por HTTP.
function allowedKeys(data, allowedFields) {
  if (Object.keys(data).some((field) => !allowedFields.includes(field))) {
    throw new Error('El modelo recibió un campo no permitido.');
  }
  const fields = allowedFields.filter((field) => Object.hasOwn(data, field));
  if (fields.length === 0) {
    throw new Error('El modelo necesita al menos un campo para escribir.');
  }
  return fields;
}

function buildInsert(data, allowedFields) {
  const fields = allowedKeys(data, allowedFields);
  return {
    columns: fields.map((field) => `\`${field}\``).join(', '),
    placeholders: fields.map(() => '?').join(', '),
    values: fields.map((field) => data[field]),
  };
}

function buildUpdate(data, allowedFields) {
  const fields = allowedKeys(data, allowedFields);
  return {
    assignments: fields.map((field) => `\`${field}\` = ?`).join(', '),
    values: fields.map((field) => data[field]),
  };
}

module.exports = { buildInsert, buildUpdate };
