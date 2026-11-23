'use strict';

const AppError = require('../utils/AppError');
const schemas = require('./schemas');

function invalid(details) {
  throw new AppError(400, 'Datos inválidos. Revisa los campos indicados.', details);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

// Validación de calendario sin aceptar el ajuste automático de fechas de JavaScript.
function isDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  if (year < 1000 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

function isDateTime(value) {
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
  return Boolean(match && isDate(match[1]) && Number(match[2]) <= 23 &&
    Number(match[3]) <= 59 && Number(match[4]) <= 59);
}

function decimalPlaces(value) {
  const [mantissa, exponent = '0'] = String(value).toLowerCase().split('e');
  return Math.max(0, (mantissa.split('.')[1] || '').length - Number(exponent));
}

function normalizeField(value, rule) {
  if (value === null) {
    if (rule.nullable) return null;
    throw new Error('No puede ser null.');
  }

  if (rule.type === 'integer' || rule.type === 'decimal') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('Debe ser un número JSON, sin comillas.');
    }
    if (rule.type === 'integer' && !Number.isInteger(value)) {
      throw new Error('Debe ser un número entero.');
    }
    if (value < rule.min || value > rule.max) {
      throw new Error(`Debe estar entre ${rule.min} y ${rule.max}.`);
    }
    if (rule.type === 'decimal' && decimalPlaces(value) > rule.scale) {
      throw new Error(`Debe tener como máximo ${rule.scale} decimales.`);
    }
    return value;
  }

  if (rule.type === 'flag') {
    if (value === true) return 1;
    if (value === false) return 0;
    if (value !== 0 && value !== 1) throw new Error('Debe ser 0, 1, false o true.');
    return value;
  }

  if (typeof value !== 'string') throw new Error('Debe ser texto.');
  if (rule.type === 'password') {
    if (Array.from(value).length < 8 || !value.trim() || Buffer.byteLength(value, 'utf8') > 72) {
      throw new Error('Debe tener al menos 8 caracteres y como máximo 72 bytes UTF-8.');
    }
    return value; // La contraseña no se recorta ni se devuelve al cliente.
  }

  const normalized = value.trim();
  if (!normalized) throw new Error('No puede estar vacío.');
  if (rule.max && Array.from(normalized).length > rule.max) {
    throw new Error(`Debe tener como máximo ${rule.max} caracteres.`);
  }
  if (rule.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Debe ser un correo electrónico válido.');
  }
  if (rule.type === 'enum' && !rule.values.includes(normalized)) {
    throw new Error(`Valores permitidos: ${rule.values.join(', ')}.`);
  }
  if (rule.type === 'date' && !isDate(normalized)) {
    throw new Error('Debe ser una fecha real con formato YYYY-MM-DD (año 1000 a 9999).');
  }
  if (rule.type === 'datetime' && !isDateTime(normalized)) {
    throw new Error('Debe ser una fecha y hora reales con formato YYYY-MM-DD HH:mm:ss.');
  }
  return normalized;
}

function validateBody(moduleName, body, { partial = false, current = null } = {}) {
  if (!Object.hasOwn(schemas, moduleName)) throw new Error('Módulo de validación desconocido.');
  if (!isPlainObject(body)) invalid([{ field: 'body', message: 'Envía un objeto JSON válido.' }]);

  const schema = schemas[moduleName];
  const data = {};
  const details = [];
  const keys = Object.keys(body);
  if (partial && keys.length === 0) {
    invalid([{ field: 'body', message: 'Envía al menos un campo para actualizar.' }]);
  }

  for (const key of keys) {
    if (!Object.hasOwn(schema, key) || (partial && schema[key].createOnly)) {
      details.push({ field: key, message: 'Campo no permitido o de solo lectura.' });
      continue;
    }
    try {
      data[key] = normalizeField(body[key], schema[key]);
    } catch (error) {
      details.push({ field: key, message: error.message });
    }
  }

  if (!partial) {
    for (const [key, rule] of Object.entries(schema)) {
      if (rule.required && !Object.hasOwn(body, key)) {
        details.push({ field: key, message: 'Este campo es obligatorio.' });
      }
    }
  }

  // PATCH conserva campos omitidos; las restricciones se comprueban sobre el resultado.
  const merged = { ...current, ...data };
  if (moduleName === 'zonas_origen' && merged.altitud_max < merged.altitud_min) {
    details.push({ field: 'altitud_max', message: 'Debe ser mayor o igual que altitud_min.' });
  }
  if (moduleName === 'mensajes_contacto' && merged.estado === 'Respondido') {
    if (typeof merged.respuesta !== 'string' || !merged.respuesta.trim()) {
      details.push({ field: 'respuesta', message: 'Es obligatoria cuando el estado es Respondido.' });
    }
    if (typeof merged.fecha_respuesta !== 'string' || !isDateTime(merged.fecha_respuesta)) {
      details.push({ field: 'fecha_respuesta', message: 'Es obligatoria y debe ser válida cuando el estado es Respondido.' });
    }
  }

  if (details.length) invalid(details);
  return data;
}

function parseIntegerParameter(value, min, max, field) {
  const validSyntax = typeof value === 'number' ||
    (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value));
  const number = validSyntax ? Number(value) : NaN;
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    invalid([{ field, message: `Debe ser un número entero entre ${min} y ${max}.` }]);
  }
  return number;
}

function validateId(value, max = 4294967295, label = 'id') {
  return parseIntegerParameter(value, 1, max, label);
}

function validatePagination(query = {}) {
  if (!isPlainObject(query)) invalid([{ field: 'query', message: 'Parámetros de consulta inválidos.' }]);
  const unknown = Object.keys(query).filter(key => !['limit', 'offset'].includes(key));
  if (unknown.length) invalid(unknown.map(field => ({ field, message: 'Parámetro no permitido. Usa limit y offset.' })));
  return {
    limit: Object.hasOwn(query, 'limit') ? parseIntegerParameter(query.limit, 1, 100, 'limit') : 20,
    offset: Object.hasOwn(query, 'offset') ? parseIntegerParameter(query.offset, 0, 1000000, 'offset') : 0
  };
}

module.exports = { validateBody, validateId, validatePagination };
