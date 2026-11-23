# Cumbre Café — Referencia de la API

## 1. Dirección y formato

La dirección local predeterminada es `http://127.0.0.1:3000`. Todas las rutas comienzan por `/api`. Si cambias `HOST` o `PORT` en `.env`, adapta la dirección de las solicitudes y la variable `baseUrl` de Postman.

Para crear o actualizar, envía el cuerpo como JSON y este encabezado:

```http
Content-Type: application/json
```

El límite del cuerpo es **32 KB**. Los listados, consultas por identificador y eliminaciones no necesitan cuerpo. Los ejemplos siguientes son solicitudes de demostración; las respuestas de ejemplo ilustran el formato y no sustituyen las evidencias de ejecución.

## 2. Módulos y endpoints

Hay **nueve módulos**, correspondientes a las nueve tablas del proyecto. Cada módulo tiene cinco operaciones: listar, crear, consultar por identificador, actualizar parcialmente y eliminar.

| Tabla | GET: listar / POST: crear | GET, PATCH y DELETE: registro individual | Clave y máximo permitido |
|---|---|---|---|
| `roles` | `/api/roles` | `/api/roles/:id` | `id_rol`: 255 |
| `usuarios` | `/api/usuarios` | `/api/usuarios/:id` | `id_usuario`: 4294967295 |
| `zonas_origen` | `/api/zonas-origen` | `/api/zonas-origen/:id` | `id_zona`: 65535 |
| `productores` | `/api/productores` | `/api/productores/:id` | `id_productor`: 4294967295 |
| `granos` | `/api/granos` | `/api/granos/:id` | `id_grano`: 4294967295 |
| `metodos_preparacion` | `/api/metodos-preparacion` | `/api/metodos-preparacion/:id` | `id_metodo`: 65535 |
| `cafeterias_aliadas` | `/api/cafeterias-aliadas` | `/api/cafeterias-aliadas/:id` | `id_cafeteria`: 4294967295 |
| `cafeteria_grano` | `/api/cafeteria-grano` | `/api/cafeteria-grano/:id_cafeteria/:id_grano` | Ambas claves: 4294967295 |
| `mensajes_contacto` | `/api/mensajes-contacto` | `/api/mensajes-contacto/:id` | `id_mensaje`: 4294967295 |

Los identificadores deben ser enteros positivos. En la URL escribe, por ejemplo, `1`; se rechazan valores como `0`, `-1`, `1.5`, `01`, `1abc` y los superiores al máximo de la tabla.

### Ejemplo de las cinco operaciones

Para el módulo de roles, los cinco endpoints son:

| Método | Ruta | Operación | Respuesta correcta |
|---|---|---|---|
| GET | `/api/roles` | Listar registros | 200 |
| POST | `/api/roles` | Crear un registro | 201 |
| GET | `/api/roles/4` | Consultar el rol 4 | 200 |
| PATCH | `/api/roles/4` | Modificar los campos enviados del rol 4 | 200 |
| DELETE | `/api/roles/4` | Eliminar el rol 4 | 200 |

Reemplaza `4` por el identificador que devuelva tu POST. El mismo patrón se aplica a los otros módulos; `cafeteria_grano` utiliza dos identificadores porque su clave primaria es compuesta. La actualización implementada es **PATCH**; no hay endpoint PUT.

### Comprobación de disponibilidad

```http
GET /api/health
```

Ejecuta una consulta a MySQL y responde 200 cuando están disponibles la API y la conexión:

```json
{
  "success": true,
  "message": "API y base de datos disponibles.",
  "data": { "status": "ok" }
}
```

## 3. Listados y paginación

Todos los listados aceptan estos dos parámetros opcionales:

| Parámetro | Valor predeterminado | Valores permitidos | Significado |
|---|---|---|---|
| `limit` | 20 | Entero entre 1 y 100 | Máximo de registros de esa página |
| `offset` | 0 | Entero entre 0 y 1000000 | Número de registros que se omiten |

```http
GET /api/granos?limit=10&offset=0
GET /api/granos?limit=10&offset=10
```

Omitir los parámetros utiliza sus valores predeterminados. Enviar un valor vacío, como `?limit=`, un parámetro repetido, un número fuera del rango o un parámetro desconocido devuelve 400. Por ejemplo, `?nombre=Café` no es un filtro implementado.

Los resultados se ordenan de forma ascendente por la clave primaria. En `cafeteria_grano`, el orden es por cafetería y luego por grano. Un listado sin coincidencias devuelve 200 con `data: []`.

Ejemplo ilustrativo del formato de un listado:

```json
{
  "success": true,
  "message": "Consulta realizada correctamente.",
  "data": [
    { "id_rol": 1, "nombre": "Administrador", "descripcion": "Acceso total al panel de administración" }
  ],
  "pagination": { "limit": 1, "offset": 0, "count": 1 }
}
```

`count` representa la cantidad de registros de la página devuelta, no el total de la tabla.

## 4. Reglas generales de entrada

- Envía un objeto JSON. Se rechazan cuerpos que sean arrays, texto, números o `null`.
- Los campos numéricos del cuerpo deben ser números JSON: `"id_rol": 2` es válido; `"id_rol": "2"` no lo es.
- Los indicadores `activo`, `disponible` y `certificacion_organica` aceptan `0`, `1`, `false` o `true`. Los booleanos se guardan como `0/1`.
- Los textos se recortan en los extremos. Un texto vacío o formado únicamente por espacios se rechaza. Los límites se miden en caracteres Unicode.
- Los campos indicados como nullable aceptan `null`; los demás lo rechazan. Omitir un campo opcional permite que MySQL aplique su valor predeterminado al crear.
- Los campos desconocidos o de solo lectura devuelven 400. Las claves autoincrementales se generan en MySQL; no se envían en el POST ni se modifican con PATCH.
- Las fechas usan `YYYY-MM-DD`; las fechas con hora usan `YYYY-MM-DD HH:mm:ss`, en formato de 24 horas y sin sufijo de zona horaria. Deben ser fechas reales entre los años 1000 y 9999. `2026-02-30` no es válido.
- Los ENUM respetan sus valores exactos, incluidas mayúsculas y tildes. Por ejemplo, `Fácil` y `Orgánico`.
- Los IDs relacionados deben existir. Su existencia y las reglas de eliminación se comprueban en MySQL mediante las claves foráneas.

### POST y PATCH

Los campos marcados como **obligatorios** en las secciones siguientes se requieren al crear. PATCH admite uno o más campos editables, conserva los omitidos y devuelve el registro completo actualizado. No se admite un PATCH con `{}`.

El registro debe existir antes de actualizarlo. Si su identificador es válido pero no existe, la respuesta es 404.

## 5. Cuerpos de cada módulo

Los ejemplos usan los datos incluidos en el script SQL: rol 2, zona 1, productor 1, cafetería 4 y grano 8. Si modificaste esos registros, utiliza IDs existentes en tu base. Cambia el sufijo de los nombres y correos al repetir las solicitudes que tienen campos únicos.

### 5.1. Roles

`POST /api/roles`

| Campo | Reglas |
|---|---|
| `nombre` | Obligatorio; texto, máximo 30 caracteres; único |
| `descripcion` | Opcional y nullable; texto, máximo 120 caracteres |

```json
{
  "nombre": "Revisor API 001",
  "descripcion": "Rol creado para demostrar el módulo de roles."
}
```

### 5.2. Usuarios

`POST /api/usuarios`

| Campo | Reglas |
|---|---|
| `id_rol` | Obligatorio; entero de 1 a 255; referencia a `roles` |
| `nombre` | Obligatorio; texto, máximo 80 caracteres |
| `email` | Obligatorio; correo válido, máximo 100 caracteres; único |
| `password` | Obligatorio al crear; mínimo 8 caracteres y máximo 72 bytes UTF-8 |
| `activo` | Opcional; indicador 0/1; predeterminado 1 |

```json
{
  "id_rol": 2,
  "nombre": "Usuario demostración 001",
  "email": "usuario.api.001@example.test",
  "password": "ClaveSoloDemo2026!",
  "activo": true
}
```

La contraseña del ejemplo es ficticia y sirve únicamente para esta demostración. El servidor calcula su hash bcrypt antes de guardarla. Las respuestas no contienen `password` ni `password_hash`; intentar enviar `password_hash` devuelve 400. La contraseña conserva sus espacios, a diferencia de los otros textos, y se rechaza si contiene únicamente espacios.

`fecha_registro` la genera MySQL y es de solo lectura. Para cambiar la contraseña utiliza PATCH con el campo `password`; si lo omites, se conserva la existente.

### 5.3. Zonas de origen

`POST /api/zonas-origen`

| Campo | Reglas |
|---|---|
| `nombre` | Obligatorio; texto, máximo 60 caracteres; único |
| `categoria` | Obligatorio; `Alta montaña`, `Valles andinos`, `Café de sombra` u `Orgánico` |
| `region` | Obligatorio; texto, máximo 60 caracteres |
| `altitud_min` | Obligatorio; entero de 0 a 65535; metros sobre el nivel del mar |
| `altitud_max` | Obligatorio; entero de 0 a 65535; mayor o igual que `altitud_min` |
| `perfil_sabor` | Obligatorio; texto, máximo 150 caracteres |
| `descripcion` | Opcional y nullable; texto, máximo 255 caracteres |
| `activo` | Opcional; indicador 0/1; predeterminado 1 |

```json
{
  "nombre": "Zona API 001",
  "categoria": "Alta montaña",
  "region": "Cusco",
  "altitud_min": 1600,
  "altitud_max": 2100,
  "perfil_sabor": "Notas frutales, cacao y acidez cítrica",
  "descripcion": "Zona de demostración para la API.",
  "activo": 1
}
```

La comparación entre altitudes también se aplica en PATCH. Si solo actualizas `altitud_min`, se compara con el `altitud_max` guardado.

### 5.4. Productores

`POST /api/productores`

| Campo | Reglas |
|---|---|
| `id_zona` | Obligatorio; entero de 1 a 65535; referencia a `zonas_origen` |
| `nombre` | Obligatorio; texto, máximo 100 caracteres; único |
| `telefono` | Opcional y nullable; texto, máximo 20 caracteres |
| `email` | Opcional y nullable; correo válido, máximo 100 caracteres |
| `certificacion_organica` | Opcional; indicador 0/1; predeterminado 0 |
| `activo` | Opcional; indicador 0/1; predeterminado 1 |

```json
{
  "id_zona": 1,
  "nombre": "Productor API 001",
  "telefono": "999000001",
  "email": "productor.api.001@example.test",
  "certificacion_organica": true,
  "activo": true
}
```

El teléfono se envía como texto para conservar prefijos, signos y ceros iniciales.

### 5.5. Granos

`POST /api/granos`

| Campo | Reglas |
|---|---|
| `id_productor` | Obligatorio; entero de 1 a 4294967295; referencia a `productores` |
| `nombre` | Obligatorio; texto, máximo 80 caracteres; único |
| `variedad` | Obligatorio; texto, máximo 40 caracteres |
| `proceso` | Obligatorio; `Lavado`, `Natural` o `Honey` |
| `tueste` | Obligatorio; `Claro`, `Medio` u `Oscuro` |
| `puntaje_taza` | Obligatorio; número entre 0 y 100; máximo 1 decimal |
| `precio_kg` | Obligatorio; número entre 0.01 y 999999.99; máximo 2 decimales; soles por kilo |
| `stock_kg` | Opcional; número entre 0 y 999999.99; máximo 2 decimales; predeterminado 0 |
| `disponible` | Opcional; indicador 0/1; predeterminado 1 |

```json
{
  "id_productor": 1,
  "nombre": "Grano API 001",
  "variedad": "Typica",
  "proceso": "Lavado",
  "tueste": "Medio",
  "puntaje_taza": 86.5,
  "precio_kg": 78.5,
  "stock_kg": 12.75,
  "disponible": 1
}
```

`precio_kg` se expresa en **PEN**. MySQL almacena los importes en columnas DECIMAL; la conexión utiliza `decimalNumbers: true`, de modo que las respuestas JSON contienen números. Por ejemplo, `78.50` puede aparecer como `78.5`, sin cambiar su valor. Se rechazan más decimales de los permitidos en lugar de redondearlos silenciosamente.

`disponible` y `stock_kg` son campos separados, como en el modelo original. Al actualizar stock mediante esta API, envía también `disponible` si deseas cambiarlo.

### 5.6. Métodos de preparación

`POST /api/metodos-preparacion`

| Campo | Reglas |
|---|---|
| `nombre` | Obligatorio; texto, máximo 50 caracteres; único |
| `descripcion` | Obligatorio; texto, máximo 255 caracteres |
| `proporcion` | Obligatorio; texto, máximo 20 caracteres; por ejemplo, `1:15` |
| `temperatura_c` | Obligatorio; entero entre 60 y 100 |
| `tiempo_seg` | Obligatorio; entero entre 1 y 65535 |
| `molienda` | Obligatorio; `Gruesa`, `Media` o `Fina` |
| `dificultad` | Obligatorio; `Fácil`, `Intermedia` o `Avanzada` |

```json
{
  "nombre": "Método API 001",
  "descripcion": "Preparación por inmersión para la demostración.",
  "proporcion": "1:15",
  "temperatura_c": 94,
  "tiempo_seg": 240,
  "molienda": "Gruesa",
  "dificultad": "Fácil"
}
```

### 5.7. Cafeterías aliadas

`POST /api/cafeterias-aliadas`

| Campo | Reglas |
|---|---|
| `id_usuario_resp` | Opcional y nullable; entero de 1 a 4294967295; referencia a `usuarios`; único cuando no es null |
| `nombre` | Obligatorio; texto, máximo 80 caracteres; único |
| `ciudad` | Obligatorio; texto, máximo 60 caracteres |
| `direccion` | Obligatorio; texto, máximo 120 caracteres |
| `telefono` | Opcional y nullable; texto, máximo 20 caracteres |
| `email` | Opcional y nullable; correo válido, máximo 100 caracteres |
| `estado` | Opcional; `Activa`, `Pendiente` o `Inactiva`; predeterminado `Pendiente` |
| `fecha_alianza` | Obligatorio; fecha `YYYY-MM-DD` |

```json
{
  "id_usuario_resp": null,
  "nombre": "Cafetería API 001",
  "ciudad": "Lima",
  "direccion": "Calle Demostración 100",
  "telefono": "999000002",
  "email": "cafeteria.api.001@example.test",
  "estado": "Pendiente",
  "fecha_alianza": "2026-11-23"
}
```

El ejemplo deja al responsable en null para evitar reutilizar un usuario ya asignado a otra cafetería. Si envías un ID, ese usuario debe existir y no estar vinculado como responsable de otra cafetería. El CRUD respeta las restricciones SQL; no agrega una validación de rol adicional.

### 5.8. Relación cafetería–grano

`POST /api/cafeteria-grano`

| Campo | Reglas |
|---|---|
| `id_cafeteria` | Obligatorio al crear; entero de 1 a 4294967295; referencia a `cafeterias_aliadas` |
| `id_grano` | Obligatorio al crear; entero de 1 a 4294967295; referencia a `granos` |
| `fecha_inicio` | Obligatorio al crear; fecha `YYYY-MM-DD`; único campo editable con PATCH |

```json
{
  "id_cafeteria": 4,
  "id_grano": 8,
  "fecha_inicio": "2026-11-23"
}
```

La combinación `(4, 8)` no figura entre las relaciones iniciales del SQL. Crear la misma combinación una segunda vez devuelve 409. Para consultarla, actualizarla o eliminarla, usa ambos IDs:

```http
GET /api/cafeteria-grano/4/8
PATCH /api/cafeteria-grano/4/8
DELETE /api/cafeteria-grano/4/8
```

Las dos claves son inmutables en PATCH. Para cambiar la combinación, elimina la relación anterior y crea la nueva. Esta tabla puede vincular un grano aunque `disponible` sea 0: el SQL original no limita las relaciones por disponibilidad.

### 5.9. Mensajes de contacto

`POST /api/mensajes-contacto`

| Campo | Reglas |
|---|---|
| `id_usuario_atiende` | Opcional y nullable; entero de 1 a 4294967295; referencia a `usuarios` |
| `nombre` | Obligatorio; texto, máximo 80 caracteres |
| `email` | Obligatorio; correo válido, máximo 100 caracteres |
| `mensaje` | Obligatorio; texto, máximo 1000 caracteres |
| `estado` | Opcional; `Nuevo`, `En proceso` o `Respondido`; predeterminado `Nuevo` |
| `respuesta` | Opcional y nullable; texto, máximo 1000 caracteres; requerido si el estado final es `Respondido` |
| `fecha_respuesta` | Opcional y nullable; fecha y hora `YYYY-MM-DD HH:mm:ss`; requerida si el estado final es `Respondido` |

```json
{
  "id_usuario_atiende": null,
  "nombre": "Contacto API 001",
  "email": "contacto.api.001@example.test",
  "mensaje": "¿Qué granos recomiendan para preparar café filtrado?",
  "estado": "Nuevo"
}
```

`fecha_envio` la genera MySQL y es de solo lectura. Para marcar un mensaje como `Respondido`, el registro resultante debe tener una respuesta no vacía y una fecha de respuesta válida. Estos campos no se completan automáticamente.

## 6. Ejemplos de actualización parcial

### Modificar un solo dato

```http
PATCH /api/roles/4
Content-Type: application/json
```

```json
{
  "descripcion": "Descripción actualizada desde la API."
}
```

Se conserva `nombre`. También puedes enviar `"descripcion": null` porque ese campo es nullable.

### Cambiar stock y disponibilidad

```http
PATCH /api/granos/1
Content-Type: application/json
```

```json
{
  "stock_kg": 0,
  "disponible": false
}
```

### Responder un mensaje

```http
PATCH /api/mensajes-contacto/1
Content-Type: application/json
```

```json
{
  "id_usuario_atiende": 2,
  "estado": "Respondido",
  "respuesta": "Te recomendamos un grano de tueste medio y molienda media.",
  "fecha_respuesta": "2026-11-23 14:30:00"
}
```

El ID 2 corresponde a un usuario de prueba del SQL. El CRUD valida su existencia, además de los tipos y la consistencia de respuesta/fecha. No interpreta este campo como una sesión iniciada ni como una autorización.

### Actualizar una relación existente

```http
PATCH /api/cafeteria-grano/4/8
Content-Type: application/json
```

```json
{
  "fecha_inicio": "2026-11-24"
}
```

## 7. Respuestas y códigos HTTP

| Código | Situación |
|---|---|
| 200 | Listado, consulta, actualización o eliminación correctos |
| 201 | Registro creado; el encabezado `Location` contiene su ruta |
| 400 | Datos inválidos, JSON mal formado, ID/parámetro inválido, referencia inexistente o restricción incumplida |
| 404 | Registro inexistente o ruta/método no implementados |
| 409 | Valor único o relación duplicados, o eliminación impedida por registros dependientes |
| 413 | Cuerpo superior a 32 KB |
| 415 | POST/PATCH sin `Content-Type: application/json` o codificación no admitida |
| 500 | Error interno o de conexión; la respuesta no expone SQL, credenciales ni trazas |

### Operaciones correctas

POST de un rol, ejemplo ilustrativo de respuesta 201:

```json
{
  "success": true,
  "message": "Registro creado correctamente.",
  "data": {
    "id_rol": 4,
    "nombre": "Revisor API 001",
    "descripcion": "Rol creado para demostrar el módulo de roles."
  }
}
```

El ID efectivo depende de los registros existentes. Usa el devuelto en `data` o la ruta recibida en `Location`.

Los mensajes correctos son:

| Operación | Mensaje |
|---|---|
| GET listado | `Consulta realizada correctamente.` |
| GET por identificador | `Registro encontrado.` |
| POST | `Registro creado correctamente.` |
| PATCH | `Registro actualizado correctamente.` |
| DELETE | `Registro eliminado correctamente.` |

En `cafeteria_grano`, los mensajes de escritura son `Relación creada correctamente.`, `Relación actualizada correctamente.` y `Relación eliminada correctamente.`. DELETE responde 200 con la clave eliminada, por ejemplo `"data": {"id_rol": 4}` o `"data": {"id_cafeteria": 4, "id_grano": 8}`.

### Error de validación

Enviar `POST /api/roles` con `{}` devuelve:

```json
{
  "success": false,
  "message": "Datos inválidos. Revisa los campos indicados.",
  "errors": [
    { "field": "nombre", "message": "Este campo es obligatorio." }
  ]
}
```

### Registro inexistente

Si un rol no existe, su GET, PATCH o DELETE devuelve 404:

```json
{
  "success": false,
  "message": "Rol no encontrado."
}
```

Cada módulo adapta el nombre del recurso en este mensaje.

### Duplicados y referencias

Un valor único repetido devuelve 409:

```json
{
  "success": false,
  "message": "Ya existe un registro con ese valor único o con esa relación."
}
```

Una clave foránea que no existe devuelve 400:

```json
{
  "success": false,
  "message": "La referencia indicada no existe. Revisa los identificadores relacionados."
}
```

Una eliminación restringida devuelve 409:

```json
{
  "success": false,
  "message": "No se puede eliminar el registro porque otros registros dependen de él."
}
```

Un error interno devuelve 500:

```json
{
  "success": false,
  "message": "Ocurrió un error interno. Intenta nuevamente o contacta al responsable del sistema."
}
```

## 8. Relaciones al eliminar

Se mantienen las reglas del proyecto SQL original:

| Registro eliminado | Comportamiento |
|---|---|
| Rol con usuarios | Eliminación restringida: 409 |
| Zona con productores | Eliminación restringida: 409 |
| Productor con granos | Eliminación restringida: 409 |
| Usuario | Las cafeterías y mensajes asociados conservan sus registros y ponen su referencia al usuario en null |
| Cafetería | Se eliminan también sus filas en `cafeteria_grano` |
| Grano | Se eliminan también sus filas en `cafeteria_grano` |
| Relación cafetería–grano | Se elimina solo esa relación, conservando la cafetería y el grano |

Cuando quieras eliminar toda una cadena de prueba, empieza por las relaciones y los registros dependientes. No es necesario desactivar las claves foráneas.

## 9. Probar desde Postman o PowerShell

En Postman, importa `postman/Cumbre_Cafe.postman_collection.json` y `postman/Local.postman_environment.json`. Selecciona el entorno local y comprueba `baseUrl`. Para una solicitud manual de creación, elige **Body → raw → JSON**, pega el cuerpo y pulsa **Send**.

En Windows PowerShell puedes comprobar la conexión y crear un rol así:

```powershell
$baseUrl = 'http://127.0.0.1:3000'
Invoke-RestMethod -Method Get -Uri "$baseUrl/api/health"

$cuerpo = @{
    nombre = 'Revisor PowerShell 001'
    descripcion = 'Ejemplo para comprobar la API'
} | ConvertTo-Json

$resultado = Invoke-RestMethod -Method Post `
    -Uri "$baseUrl/api/roles" `
    -ContentType 'application/json; charset=utf-8' `
    -Body ([System.Text.Encoding]::UTF8.GetBytes($cuerpo))

$resultado | ConvertTo-Json -Depth 5
$idCreado = $resultado.data.id_rol
Invoke-RestMethod -Method Get -Uri "$baseUrl/api/roles/$idCreado"
```

El GET final consulta exactamente el registro creado. Esa secuencia permite presentar las dos evidencias por módulo: solicitud/respuesta de creación y solicitud/respuesta de consulta por identificador.

## 10. Alcance de esta API

Este proyecto implementa el CRUD académico de las nueve tablas y utiliza las relaciones existentes. Las vistas y los procedimientos del SQL se conservan; no tienen rutas adicionales porque no son tablas CRUD.

La API no implementa inicio de sesión ni autorización de acceso. Los roles y usuarios son recursos de la base de datos, y el hash de contraseña protege su almacenamiento; no equivalen a un control de acceso a los endpoints. La configuración predeterminada atiende en `127.0.0.1` para la demostración local. La conexión privada se configura en `.env`, que no debe incorporarse al repositorio.

La referencia se corresponde con `src/routes`, `src/controllers`, `src/validators/schemas.js`, `src/middleware/errorHandler.js` y el script SQL incluido en esta entrega.
