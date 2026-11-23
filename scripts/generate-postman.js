'use strict';

// Genera una colección reproducible desde los mismos datos de prueba del proyecto.
const fs = require('node:fs');
const path = require('node:path');
const { modules } = require('./fixtures');

const outputDir = path.resolve(__dirname, '../postman');
const keysFor = (module) => module.id ? [module.id] : ['id_cafeteria', 'id_grano'];
const variableFor = (module, key) => `${module.table}_${key}`;
const idVariables = modules.flatMap(module => keysFor(module).map(key => variableFor(module, key)));
const placeholder = (key) => `{{${key}}}`;
const refs = Object.fromEntries(modules.map(module => [module.table,
  Object.fromEntries(keysFor(module).map(key => [key, placeholder(variableFor(module, key))]))
]));

function resourceUrl(module) {
  const identifiers = keysFor(module).map(key => placeholder(variableFor(module, key))).join('/');
  return `{{baseUrl}}/api/${module.path}/${identifiers}`;
}

function rawJson(body) {
  let raw = JSON.stringify(body, null, 2);
  // Un ID relacionado debe enviarse como número JSON; los demás campos siguen como texto.
  for (const name of idVariables) {
    raw = raw.replaceAll(JSON.stringify(placeholder(name)), placeholder(name));
  }
  return raw;
}

function beforeRequest(requiredVariables, initialize = false) {
  const lines = [];
  if (initialize) {
    lines.push(
      '// Se ejecuta una vez al inicio de cada iteración completa de Collection Runner.',
      `const ids = ${JSON.stringify(idVariables)};`,
      'ids.forEach(name => pm.collectionVariables.unset(name));',
      "const tag = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);",
      "pm.collectionVariables.set('runTag', tag);"
    );
  }
  lines.push(
    '// Las variables locales evitan que un ID del entorno sustituya un ID recién creado.',
    `const names = ${JSON.stringify(['runTag', ...idVariables])};`,
    "names.forEach(name => pm.variables.set(name, pm.collectionVariables.get(name) || ''));",
    `const required = ${JSON.stringify(requiredVariables)};`,
    'const missing = required.filter(name => !pm.collectionVariables.get(name));',
    'if (missing.length) {',
    "  console.error('Faltan referencias creadas por esta colección:', missing.join(', '));",
    "  if (typeof pm.execution.skipRequest === 'function') pm.execution.skipRequest();",
    "  throw new Error('Ejecuta la colección completa, desde Roles, para crear sus dependencias.');",
    '}'
  );
  return lines;
}

function testsFor(module, action, expectedStatus) {
  const lines = [
    `pm.test('HTTP ${expectedStatus}', () => pm.response.to.have.status(${expectedStatus}));`,
    'const response = pm.response.json();',
    "pm.test('Respuesta comprensible y exitosa', () => {",
    '  pm.expect(response.success).to.eql(true);',
    "  pm.expect(response.message).to.be.a('string').and.not.empty;",
    '});'
  ];

  if (action === 'list') {
    lines.push(
      "pm.test('Lista y paginación coherentes', () => {",
      "  pm.expect(response.data).to.be.an('array');",
      '  pm.expect(response.pagination.limit).to.eql(20);',
      '  pm.expect(response.pagination.offset).to.eql(0);',
      '  pm.expect(response.pagination.count).to.eql(response.data.length);',
      '});'
    );
  } else {
    lines.push("pm.test('Datos del registro presentes', () => pm.expect(response.data).to.be.an('object'));");
    for (const key of keysFor(module)) {
      const variable = variableFor(module, key);
      if (action === 'create') {
        lines.push(
          `pm.test('Identificador válido: ${key}', () => {`,
          `  pm.expect(Number.isInteger(response.data.${key})).to.eql(true);`,
          `  pm.expect(response.data.${key}).to.be.above(0);`,
          '});',
          `if (pm.response.code === 201 && response.success === true && Number.isInteger(response.data.${key}) && response.data.${key} > 0) {`,
          `  pm.collectionVariables.set('${variable}', String(response.data.${key}));`,
          '}'
        );
      } else {
        lines.push(
          `pm.test('Corresponde al registro creado: ${key}', () => {`,
          `  pm.expect(response.data.${key}).to.eql(Number(pm.collectionVariables.get('${variable}')));`,
          '});'
        );
      }
    }
  }

  if (action === 'create' || action === 'patch') {
    lines.push(
      'const sent = JSON.parse(pm.variables.replaceIn(pm.request.body.raw));',
      "pm.test('Los campos enviados quedaron guardados', () => {",
      '  Object.entries(sent).forEach(([field, value]) => {',
      "    if (field === 'password') return;",
      "    const expected = typeof value === 'boolean' ? Number(value) : value;",
      '    pm.expect(response.data[field], field).to.eql(expected);',
      '  });',
      '});'
    );
  }

  if (module.table === 'usuarios') {
    lines.push(
      "pm.test('La API nunca devuelve contraseñas ni hashes', () => {",
      '  const rows = Array.isArray(response.data) ? response.data : [response.data];',
      '  rows.forEach(row => {',
      "    pm.expect(row).not.to.have.property('password');",
      "    pm.expect(row).not.to.have.property('password_hash');",
      '  });',
      '});'
    );
  }

  if (action === 'delete') {
    lines.push(
      'if (pm.response.code === 200 && response.success === true) {',
      ...keysFor(module).map(key => `  pm.collectionVariables.unset('${variableFor(module, key)}');`),
      '}'
    );
  }
  return lines;
}

function requestFor(module, action, position) {
  const createBody = module.create(refs, '{{runTag}}');
  const settings = {
    create: { method: 'POST', title: 'Crear', status: 201, body: createBody },
    read: { method: 'GET', title: 'Consultar por identificador', status: 200 },
    list: { method: 'GET', title: 'Listar', status: 200 },
    patch: { method: 'PATCH', title: 'Actualizar parcialmente', status: 200, body: module.patch },
    delete: { method: 'DELETE', title: 'Eliminar', status: 200 }
  }[action];
  const isCollectionPath = action === 'create' || action === 'list';
  const url = isCollectionPath ? `{{baseUrl}}/api/${module.path}` : resourceUrl(module);
  const requiredVariables = action === 'create'
    ? ['runTag', ...Object.values(createBody)
      .filter(value => typeof value === 'string' && /^\{\{[^}]+\}\}$/.test(value))
      .map(value => value.slice(2, -2))]
    : action === 'list' ? [] : keysFor(module).map(key => variableFor(module, key));
  const descriptions = {
    create: 'Crea un registro ficticio y guarda los identificadores de la respuesta en variables de colección. Debe ejecutarse antes de las consultas por ID, PATCH y DELETE.',
    read: 'Consulta exactamente el registro que creó el POST de este módulo. Para una relación cafetería-grano se utilizan los dos identificadores.',
    list: 'Consulta la primera página: 20 registros como máximo y desplazamiento 0. La API también acepta ?limit=10&offset=0.',
    patch: 'PATCH modifica únicamente los campos enviados; conserva los omitidos y respeta las relaciones y restricciones. Las claves primarias no se actualizan.',
    delete: 'Elimina exclusivamente el registro cuyo ID se capturó en el POST. Ejecutar esta fase al finalizar; el orden inverso conserva la integridad referencial.'
  };
  const request = {
    method: settings.method,
    header: [{ key: 'Accept', value: 'application/json', type: 'text' }],
    url,
    description: `${module.title} — tabla ${module.table}.\n\n${descriptions[action]}`
  };
  if (settings.body) {
    request.header.push({ key: 'Content-Type', value: 'application/json', type: 'text' });
    request.body = { mode: 'raw', raw: rawJson(settings.body), options: { raw: { language: 'json' } } };
  }
  return {
    name: `${String(position).padStart(2, '0')} ${settings.method} — ${settings.title} · ${module.title}`,
    request,
    event: [
      { listen: 'prerequest', script: { type: 'text/javascript', exec: beforeRequest(requiredVariables, module.table === 'roles' && action === 'create') } },
      { listen: 'test', script: { type: 'text/javascript', exec: testsFor(module, action, settings.status) } }
    ],
    response: []
  };
}

let position = 1;
const createFolders = modules.map(module => ({
  name: module.title,
  description: `Tabla: ${module.table}. Cuatro operaciones aquí; su DELETE está en la fase 2 para no romper las dependencias. Para las evidencias mínimas se pueden presentar POST y GET por identificador.`,
  item: ['create', 'read', 'list', 'patch'].map(action => requestFor(module, action, position++))
}));
const deleteRequests = [...modules].reverse().map(module => requestFor(module, 'delete', position++));
const collection = {
  info: {
    name: 'Cumbre Café — API MVC completa (45 endpoints)',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    description: [
      '# Cumbre Café — nueve módulos y CRUD completo',
      '',
      'Importa esta colección y Local.postman_environment.json; selecciona el entorno Local. Inicia la API y usa Collection Runner para ejecutar la colección completa, en el orden original, con una iteración.',
      '',
      '**Fase 1:** nueve módulos, cada uno con POST, GET por ID, GET de listado y PATCH (36 solicitudes). **Fase 2:** nueve DELETE en orden inverso de dependencias. Se evitan eliminaciones prematuras de roles, usuarios, zonas, productores o granos.',
      '',
      'Cada ejecución comienza en POST Roles: crea una etiqueta única, limpia los identificadores anteriores y captura los nuevos IDs desde las respuestas. No hay IDs fijos para eliminar datos de la carga inicial. Un módulo aislado necesita que sus padres hayan sido creados en esta misma ejecución. No modifiques los IDs de la colección ni los sustituyas por datos reales.',
      '',
      'Usa una base local de demostración. Una ejecución satisfactoria elimina al final sus propios registros. Si interrumpes la ejecución, reanuda la fase de limpieza antes de comenzar otra. Una respuesta fallida conserva su identificador para facilitar el diagnóstico y la limpieza.',
      '',
      'PATCH realiza actualizaciones parciales. cafeteria_grano utiliza la clave compuesta id_cafeteria/id_grano; únicamente fecha_inicio puede modificarse. Los números de los JSON se envían sin comillas. Las contraseñas de ejemplo son ficticias y solo se envían a la API local; nunca aparecen en las respuestas.',
      '',
      'Las pruebas verifican HTTP 201/200, success, mensajes, identificadores, campos guardados, paginación y ausencia de contraseñas/hash. Para la evidencia del docente, selecciona las dos primeras solicitudes (POST y GET por ID) de cada módulo.',
      '',
      'Documentación oficial de las variables y scripts de Postman: https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-variables/ y https://learning.postman.com/docs/tests-and-scripts/write-scripts/test-scripts/.'
    ].join('\n')
  },
  variable: ['runTag', ...idVariables].map(key => ({ key, value: '', type: 'string' })),
  item: [
    { name: '1. Creación, consultas y actualización', item: createFolders },
    { name: '2. Limpieza — eliminar en orden inverso', item: deleteRequests }
  ]
};
const environment = {
  name: 'Local — Cumbre Café',
  values: [{ key: 'baseUrl', value: 'http://127.0.0.1:3000', type: 'default', enabled: true }],
  _postman_variable_scope: 'environment'
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'Cumbre_Cafe.postman_collection.json'), `${JSON.stringify(collection, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'Local.postman_environment.json'), `${JSON.stringify(environment, null, 2)}\n`);
console.log('Colección generada: 9 módulos, 45 solicitudes y entorno Local.');
