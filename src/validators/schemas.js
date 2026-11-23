'use strict';

// Campos de entrada. Las claves autogeneradas y los hashes no se reciben del cliente.
// Los valores por defecto se dejan a MySQL cuando no se envía el campo.
const schemas = {
  roles: {
    nombre: { type: 'text', max: 30, required: true },
    descripcion: { type: 'text', max: 120, nullable: true }
  },
  usuarios: {
    id_rol: { type: 'integer', min: 1, max: 255, required: true },
    nombre: { type: 'text', max: 80, required: true },
    email: { type: 'email', max: 100, required: true },
    password: { type: 'password', required: true },
    activo: { type: 'flag' }
  },
  zonas_origen: {
    nombre: { type: 'text', max: 60, required: true },
    categoria: { type: 'enum', values: ['Alta montaña', 'Valles andinos', 'Café de sombra', 'Orgánico'], required: true },
    region: { type: 'text', max: 60, required: true },
    altitud_min: { type: 'integer', min: 0, max: 65535, required: true },
    altitud_max: { type: 'integer', min: 0, max: 65535, required: true },
    perfil_sabor: { type: 'text', max: 150, required: true },
    descripcion: { type: 'text', max: 255, nullable: true },
    activo: { type: 'flag' }
  },
  productores: {
    id_zona: { type: 'integer', min: 1, max: 65535, required: true },
    nombre: { type: 'text', max: 100, required: true },
    telefono: { type: 'text', max: 20, nullable: true },
    email: { type: 'email', max: 100, nullable: true },
    certificacion_organica: { type: 'flag' },
    activo: { type: 'flag' }
  },
  granos: {
    id_productor: { type: 'integer', min: 1, max: 4294967295, required: true },
    nombre: { type: 'text', max: 80, required: true },
    variedad: { type: 'text', max: 40, required: true },
    proceso: { type: 'enum', values: ['Lavado', 'Natural', 'Honey'], required: true },
    tueste: { type: 'enum', values: ['Claro', 'Medio', 'Oscuro'], required: true },
    puntaje_taza: { type: 'decimal', min: 0, max: 100, scale: 1, required: true },
    precio_kg: { type: 'decimal', min: 0.01, max: 999999.99, scale: 2, required: true },
    stock_kg: { type: 'decimal', min: 0, max: 999999.99, scale: 2 },
    disponible: { type: 'flag' }
  },
  metodos_preparacion: {
    nombre: { type: 'text', max: 50, required: true },
    descripcion: { type: 'text', max: 255, required: true },
    proporcion: { type: 'text', max: 20, required: true },
    temperatura_c: { type: 'integer', min: 60, max: 100, required: true },
    tiempo_seg: { type: 'integer', min: 1, max: 65535, required: true },
    molienda: { type: 'enum', values: ['Gruesa', 'Media', 'Fina'], required: true },
    dificultad: { type: 'enum', values: ['Fácil', 'Intermedia', 'Avanzada'], required: true }
  },
  cafeterias_aliadas: {
    id_usuario_resp: { type: 'integer', min: 1, max: 4294967295, nullable: true },
    nombre: { type: 'text', max: 80, required: true },
    ciudad: { type: 'text', max: 60, required: true },
    direccion: { type: 'text', max: 120, required: true },
    telefono: { type: 'text', max: 20, nullable: true },
    email: { type: 'email', max: 100, nullable: true },
    estado: { type: 'enum', values: ['Activa', 'Pendiente', 'Inactiva'] },
    fecha_alianza: { type: 'date', required: true }
  },
  cafeteria_grano: {
    id_cafeteria: { type: 'integer', min: 1, max: 4294967295, required: true, createOnly: true },
    id_grano: { type: 'integer', min: 1, max: 4294967295, required: true, createOnly: true },
    fecha_inicio: { type: 'date', required: true }
  },
  mensajes_contacto: {
    id_usuario_atiende: { type: 'integer', min: 1, max: 4294967295, nullable: true },
    nombre: { type: 'text', max: 80, required: true },
    email: { type: 'email', max: 100, required: true },
    mensaje: { type: 'text', max: 1000, required: true },
    estado: { type: 'enum', values: ['Nuevo', 'En proceso', 'Respondido'] },
    respuesta: { type: 'text', max: 1000, nullable: true },
    fecha_respuesta: { type: 'datetime', nullable: true }
  }
};

module.exports = schemas;
