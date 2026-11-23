'use strict';

// Datos ficticios y dependencias de la demostración. Nunca se usan registros ajenos.
const modules = [
  {
    table: 'roles', path: 'roles', title: 'Roles', id: 'id_rol',
    create: (refs, tag) => ({ nombre: `Prueba ${tag}`, descripcion: 'Rol temporal de demostración' }),
    patch: { descripcion: 'Rol actualizado mediante PATCH' }
  },
  {
    table: 'usuarios', path: 'usuarios', title: 'Usuarios', id: 'id_usuario',
    create: (refs, tag) => ({ id_rol: refs.roles.id_rol, nombre: `Usuario ${tag}`, email: `api.${tag}@example.test`, password: `DemoCafe_${tag}!` }),
    patch: { nombre: 'Usuario actualizado', activo: true }
  },
  {
    table: 'zonas_origen', path: 'zonas-origen', title: 'Zonas de origen', id: 'id_zona',
    create: (refs, tag) => ({ nombre: `Zona ${tag}`, categoria: 'Orgánico', region: 'Cajamarca', altitud_min: 1200, altitud_max: 1800, perfil_sabor: 'Notas de cacao y frutos rojos' }),
    patch: { altitud_max: 1900, descripcion: 'Zona de prueba actualizada' }
  },
  {
    table: 'productores', path: 'productores', title: 'Productores', id: 'id_productor',
    create: (refs, tag) => ({ id_zona: refs.zonas_origen.id_zona, nombre: `Productor ${tag}`, telefono: '900000001', email: `productor.${tag}@example.test`, certificacion_organica: true }),
    patch: { telefono: '900000002', certificacion_organica: 0 }
  },
  {
    table: 'granos', path: 'granos', title: 'Granos', id: 'id_grano',
    create: (refs, tag) => ({ id_productor: refs.productores.id_productor, nombre: `Grano ${tag}`, variedad: 'Caturra', proceso: 'Lavado', tueste: 'Medio', puntaje_taza: 85.5, precio_kg: 65.5, stock_kg: 10 }),
    patch: { precio_kg: 68.9, stock_kg: 12.5 }
  },
  {
    table: 'metodos_preparacion', path: 'metodos-preparacion', title: 'Métodos de preparación', id: 'id_metodo',
    create: (refs, tag) => ({ nombre: `Método ${tag}`, descripcion: 'Método de prueba por filtrado', proporcion: '1:15', temperatura_c: 92, tiempo_seg: 180, molienda: 'Media', dificultad: 'Fácil' }),
    patch: { temperatura_c: 94, tiempo_seg: 200 }
  },
  {
    table: 'cafeterias_aliadas', path: 'cafeterias-aliadas', title: 'Cafeterías aliadas', id: 'id_cafeteria',
    create: (refs, tag) => ({ id_usuario_resp: refs.usuarios.id_usuario, nombre: `Cafetería ${tag}`, ciudad: 'Lima', direccion: 'Calle de prueba 100', fecha_alianza: '2026-11-23' }),
    patch: { estado: 'Activa', telefono: '900000003' }
  },
  {
    table: 'cafeteria_grano', path: 'cafeteria-grano', title: 'Relación cafetería-grano', id: null,
    create: (refs) => ({ id_cafeteria: refs.cafeterias_aliadas.id_cafeteria, id_grano: refs.granos.id_grano, fecha_inicio: '2026-11-23' }),
    patch: { fecha_inicio: '2026-11-24' }
  },
  {
    table: 'mensajes_contacto', path: 'mensajes-contacto', title: 'Mensajes de contacto', id: 'id_mensaje',
    create: (refs, tag) => ({ id_usuario_atiende: refs.usuarios.id_usuario, nombre: `Cliente ${tag}`, email: `cliente.${tag}@example.test`, mensaje: '¿Qué café recomiendan para preparar en V60?' }),
    patch: { estado: 'Respondido', respuesta: 'Recomendamos un café lavado de tueste medio.', fecha_respuesta: '2026-11-23 15:30:00' }
  }
];

function resourcePath(module, row) {
  return `/api/${module.path}/` + (module.id ? row[module.id] : `${row.id_cafeteria}/${row.id_grano}`);
}

module.exports = { modules, resourcePath };
