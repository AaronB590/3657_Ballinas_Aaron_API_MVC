-- Cumbre Café | instalación nueva de la API MVC
-- Motor: MySQL 8.0.16 o posterior (recomendado MySQL 8.4).
-- Este script NO elimina bases de datos ni tablas existentes.
-- Ejecútelo una sola vez sobre una base vacía. Si ya tiene el proyecto anterior,
-- use 02_migracion_password_hash.sql y conserve sus datos.
-- Datos de demostración: nombres, correos y teléfonos ficticios.
-- Los hashes de usuarios son bcrypt generados a partir de valores aleatorios
-- descartados; no se publican contraseñas. La API permite asignar una nueva
-- contraseña mediante PATCH /api/usuarios/:id. No incluye inicio de sesión.


CREATE DATABASE IF NOT EXISTS cumbre_cafe
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE cumbre_cafe;

SET NAMES utf8mb4;

/* =====================================================================
   1. TABLAS
   ===================================================================== */

-- ---------------------------------------------------------------------
-- roles: perfiles del panel de administración
-- ---------------------------------------------------------------------
CREATE TABLE roles (
    id_rol       TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre       VARCHAR(30)      NOT NULL,
    descripcion  VARCHAR(120)     NULL,
    CONSTRAINT pk_roles        PRIMARY KEY (id_rol),
    CONSTRAINT uq_roles_nombre UNIQUE (nombre)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- usuarios: acceso al panel (administradores, editores, cafeterias)
-- password_hash: bcrypt; jamás se devuelve en las respuestas de la API.
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
    id_usuario      INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    id_rol          TINYINT UNSIGNED NOT NULL,
    nombre          VARCHAR(80)      NOT NULL,
    email           VARCHAR(100)     NOT NULL,
    password_hash   VARCHAR(255)         NOT NULL,
    activo          TINYINT(1)       NOT NULL DEFAULT 1,
    fecha_registro  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_usuarios       PRIMARY KEY (id_usuario),
    CONSTRAINT uq_usuarios_email UNIQUE (email),
    CONSTRAINT fk_usuarios_roles FOREIGN KEY (id_rol)
        REFERENCES roles (id_rol)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_usuarios_email  CHECK (email LIKE '%_@_%._%'),
    CONSTRAINT ck_usuarios_activo CHECK (activo IN (0, 1))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- zonas_origen: seccion "Orígenes" del sitio
-- ---------------------------------------------------------------------
CREATE TABLE zonas_origen (
    id_zona       SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre        VARCHAR(60)       NOT NULL,
    categoria     ENUM('Alta montaña','Valles andinos','Café de sombra','Orgánico') NOT NULL,
    region        VARCHAR(60)       NOT NULL,
    altitud_min   SMALLINT UNSIGNED NOT NULL,   -- metros sobre el nivel del mar
    altitud_max   SMALLINT UNSIGNED NOT NULL,
    perfil_sabor  VARCHAR(150)      NOT NULL,
    descripcion   VARCHAR(255)      NULL,
    activo        TINYINT(1)        NOT NULL DEFAULT 1,
    CONSTRAINT pk_zonas_origen    PRIMARY KEY (id_zona),
    CONSTRAINT uq_zonas_nombre    UNIQUE (nombre),
    CONSTRAINT ck_zonas_altitud   CHECK (altitud_max >= altitud_min),
    CONSTRAINT ck_zonas_activo    CHECK (activo IN (0, 1))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- productores: quienes cultivan el café; cada uno pertenece a una zona
-- ---------------------------------------------------------------------
CREATE TABLE productores (
    id_productor           INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    id_zona                SMALLINT UNSIGNED NOT NULL,
    nombre                 VARCHAR(100)      NOT NULL,
    telefono               VARCHAR(20)       NULL,
    email                  VARCHAR(100)      NULL,
    certificacion_organica TINYINT(1)        NOT NULL DEFAULT 0,
    activo                 TINYINT(1)        NOT NULL DEFAULT 1,
    CONSTRAINT pk_productores      PRIMARY KEY (id_productor),
    CONSTRAINT uq_productores_nom  UNIQUE (nombre),
    CONSTRAINT fk_productores_zona FOREIGN KEY (id_zona)
        REFERENCES zonas_origen (id_zona)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_productores_cert   CHECK (certificacion_organica IN (0, 1)),
    CONSTRAINT ck_productores_activo CHECK (activo IN (0, 1))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- granos: catálogo de granos con perfil de sabor, precio y stock
-- (la zona de origen se obtiene a traves del productor)
-- ---------------------------------------------------------------------
CREATE TABLE granos (
    id_grano      INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    id_productor  INT UNSIGNED  NOT NULL,
    nombre        VARCHAR(80)   NOT NULL,
    variedad      VARCHAR(40)   NOT NULL,
    proceso       ENUM('Lavado','Natural','Honey') NOT NULL,
    tueste        ENUM('Claro','Medio','Oscuro')   NOT NULL,
    puntaje_taza  DECIMAL(4,1)  NOT NULL,           -- escala de 0 a 100
    precio_kg     DECIMAL(8,2)  NOT NULL,           -- soles (PEN) por kilo
    stock_kg      DECIMAL(8,2)  NOT NULL DEFAULT 0,
    disponible    TINYINT(1)    NOT NULL DEFAULT 1,
    CONSTRAINT pk_granos       PRIMARY KEY (id_grano),
    CONSTRAINT uq_granos_nom   UNIQUE (nombre),
    CONSTRAINT fk_granos_prod  FOREIGN KEY (id_productor)
        REFERENCES productores (id_productor)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_granos_puntaje CHECK (puntaje_taza BETWEEN 0 AND 100),
    CONSTRAINT ck_granos_precio  CHECK (precio_kg > 0),
    CONSTRAINT ck_granos_stock   CHECK (stock_kg >= 0),
    CONSTRAINT ck_granos_disp    CHECK (disponible IN (0, 1))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- metodos_preparacion: sección "Preparación" del sitio
-- ---------------------------------------------------------------------
CREATE TABLE metodos_preparacion (
    id_metodo       SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre          VARCHAR(50)       NOT NULL,
    descripcion     VARCHAR(255)      NOT NULL,
    proporcion      VARCHAR(20)       NOT NULL,        -- café:agua, p. ej. 1:15
    temperatura_c   TINYINT UNSIGNED  NOT NULL,
    tiempo_seg      SMALLINT UNSIGNED NOT NULL,
    molienda        ENUM('Gruesa','Media','Fina')           NOT NULL,
    dificultad      ENUM('Fácil','Intermedia','Avanzada')   NOT NULL,
    CONSTRAINT pk_metodos     PRIMARY KEY (id_metodo),
    CONSTRAINT uq_metodos_nom UNIQUE (nombre),
    CONSTRAINT ck_metodos_temp   CHECK (temperatura_c BETWEEN 60 AND 100),
    CONSTRAINT ck_metodos_tiempo CHECK (tiempo_seg > 0)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- cafeterias_aliadas: sección "Cafeterías aliadas"
-- id_usuario_resp: usuario con rol Cafetería que gestiona su ficha
-- ---------------------------------------------------------------------
CREATE TABLE cafeterias_aliadas (
    id_cafeteria     INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_usuario_resp  INT UNSIGNED NULL,
    nombre           VARCHAR(80)  NOT NULL,
    ciudad           VARCHAR(60)  NOT NULL,
    direccion        VARCHAR(120) NOT NULL,
    telefono         VARCHAR(20)  NULL,
    email            VARCHAR(100) NULL,
    estado           ENUM('Activa','Pendiente','Inactiva') NOT NULL DEFAULT 'Pendiente',
    fecha_alianza    DATE         NOT NULL,
    CONSTRAINT pk_cafeterias      PRIMARY KEY (id_cafeteria),
    CONSTRAINT uq_cafeterias_nom  UNIQUE (nombre),
    CONSTRAINT uq_cafeterias_resp UNIQUE (id_usuario_resp),
    CONSTRAINT fk_cafeterias_usuario FOREIGN KEY (id_usuario_resp)
        REFERENCES usuarios (id_usuario)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- cafeteria_grano: relación N:M (qué granos sirve cada cafetería)
-- ---------------------------------------------------------------------
CREATE TABLE cafeteria_grano (
    id_cafeteria  INT UNSIGNED NOT NULL,
    id_grano      INT UNSIGNED NOT NULL,
    fecha_inicio  DATE         NOT NULL,
    CONSTRAINT pk_cafeteria_grano PRIMARY KEY (id_cafeteria, id_grano),
    CONSTRAINT fk_cg_cafeteria FOREIGN KEY (id_cafeteria)
        REFERENCES cafeterias_aliadas (id_cafeteria)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_cg_grano FOREIGN KEY (id_grano)
        REFERENCES granos (id_grano)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- mensajes_contacto: formulario de contacto (nombre, correo, mensaje)
-- id_usuario_atiende: miembro del equipo que gestiona el mensaje
-- ---------------------------------------------------------------------
CREATE TABLE mensajes_contacto (
    id_mensaje          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_usuario_atiende  INT UNSIGNED NULL,
    nombre              VARCHAR(80)  NOT NULL,
    email               VARCHAR(100) NOT NULL,
    mensaje             VARCHAR(1000) NOT NULL,
    estado              ENUM('Nuevo','En proceso','Respondido') NOT NULL DEFAULT 'Nuevo',
    fecha_envio         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    respuesta           VARCHAR(1000) NULL,
    fecha_respuesta     DATETIME     NULL,
    CONSTRAINT pk_mensajes PRIMARY KEY (id_mensaje),
    CONSTRAINT fk_mensajes_usuario FOREIGN KEY (id_usuario_atiende)
        REFERENCES usuarios (id_usuario)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT ck_mensajes_email CHECK (email LIKE '%_@_%._%'),
    CONSTRAINT ck_mensajes_resp  CHECK (estado <> 'Respondido'
                                        OR (respuesta IS NOT NULL AND fecha_respuesta IS NOT NULL))
) ENGINE = InnoDB;

/* =====================================================================
   2. ÍNDICES
   ===================================================================== */

-- Filtrar orígenes por categoría (tarjetas de la sección Orígenes)
CREATE INDEX idx_zonas_categoria     ON zonas_origen (categoria);

-- Catálogo: filtrar granos disponibles por proceso
CREATE INDEX idx_granos_disp_proceso ON granos (disponible, proceso);

-- Listar cafeterías por ciudad y estado
CREATE INDEX idx_cafeterias_ciudad   ON cafeterias_aliadas (ciudad, estado);

-- Bandeja de mensajes: pendientes primero, más recientes arriba
CREATE INDEX idx_mensajes_estado_fecha ON mensajes_contacto (estado, fecha_envio);

/* =====================================================================
   3. DATOS DE PRUEBA
   ===================================================================== */

-- roles (3)
INSERT INTO roles (nombre, descripcion) VALUES
('Administrador', 'Acceso total al panel de administración'),
('Editor',        'Gestiona contenidos y atiende mensajes de contacto'),
('Cafetería',     'Gestiona la ficha de su cafetería aliada');

-- usuarios (5) – hashes bcrypt de valores aleatorios descartados
INSERT INTO usuarios (id_rol, nombre, email, password_hash, activo, fecha_registro) VALUES
(1, 'Administrador General', 'admin@cumbrecafe.com',      '$2a$12$19fQH3ocvbJS7mWo.mAuHeGHq5QPbfOXME8YmQ8Utod2u6fNJ5wcu', 1, '2026-09-01 09:00:00'),
(2, 'Camila Rojas',          'camila@cumbrecafe.com',     '$2a$12$X//WSUqcVLhXm37tYxc3L.N/bs8XGwh0osE/bSSZ2Vz/onzx0F3cm', 1, '2026-09-03 10:30:00'),
(3, 'Marco Delgado',         'marco@cafenube.com',        '$2a$12$DtElf6rM7Wx76vv9kEqeceTtn7Vr6KleghCEKQeKoRwV.ytIuHtdq', 1, '2026-09-10 11:15:00'),
(3, 'Lucía Paredes',         'lucia@tostaderoaltura.com', '$2a$12$IYI9t9qpGoqr6y//920VOuLf2CCQw/MX8cb0Z5FcwFVO1iMQnKvZu', 1, '2026-09-12 16:45:00'),
(3, 'Andrés Huamán',         'andres@granoytaza.com',     '$2a$12$NW2wmU.86xwnq/AUSELJq.IZVNHufvAqsi8jZYwDHPN6njyf4dUEO', 0, '2026-09-15 08:20:00');

-- zonas_origen (6)
INSERT INTO zonas_origen (nombre, categoria, region, altitud_min, altitud_max, perfil_sabor, descripcion, activo) VALUES
('Cordillera Vilcabamba',  'Alta montaña',   'Cusco',      1800, 2200, 'Acidez brillante, notas frutales y florales', 'Parcelas de altura con maduración lenta del grano.', 1),
('Sierra de Amazonas',     'Alta montaña',   'Amazonas',   1700, 2100, 'Acidez cítrica y cuerpo ligero',              'Zona de nubes y temperaturas frescas.', 1),
('Valle de La Convención', 'Valles andinos', 'Cusco',      1000, 1800, 'Dulzor equilibrado y cuerpo medio',           'Valle cálido con producción tradicional.', 1),
('Valle del Chanchamayo',  'Valles andinos', 'Junín',       900, 1700, 'Notas de caramelo y chocolate',               'Valle con larga tradición cafetalera.', 1),
('Oxapampa',               'Café de sombra', 'Pasco',      1200, 1900, 'Sabor suave y complejo, notas de nuez',       'Cultivo bajo árboles nativos.', 1),
('San Ignacio',            'Orgánico',       'Cajamarca',  1200, 1800, 'Taza limpia, dulce y con notas de frutos rojos', 'Prácticas sostenibles sin agroquímicos.', 1);

-- productores (6)
INSERT INTO productores (id_zona, nombre, telefono, email, certificacion_organica, activo) VALUES
(1, 'Cooperativa Cumbre Verde',    '984000101', 'contacto@cumbreverde.pe',   0, 1),
(2, 'Asociación Nubes del Norte',  '976000202', 'info@nubesdelnorte.pe',     0, 1),
(3, 'Finca Río Claro',             '983000303', 'riclaro@fincarioclaro.pe',  0, 1),
(4, 'Cooperativa Valle Dorado',    '964000404', 'ventas@valledorado.pe',     1, 1),
(5, 'Productores de Sombra Unidos','963000505', NULL,                        1, 1),
(6, 'Cooperativa Sendero Orgánico','975000606', 'hola@senderoorganico.pe',   1, 0);

-- granos (8)
INSERT INTO granos (id_productor, nombre, variedad, proceso, tueste, puntaje_taza, precio_kg, stock_kg, disponible) VALUES
(1, 'Vilcabamba Lavado Claro',  'Typica',  'Lavado',  'Claro', 86.5, 78.00, 40.00, 1),
(1, 'Vilcabamba Honey Medio',   'Caturra', 'Honey',   'Medio', 85.0, 72.50, 25.50, 1),
(2, 'Amazonas Cítrico',         'Bourbon', 'Lavado',  'Claro', 84.5, 70.00, 30.00, 1),
(3, 'Río Claro Dulce',          'Catimor', 'Natural', 'Medio', 82.0, 55.00, 60.00, 1),
(4, 'Dorado Chocolate',         'Caturra', 'Lavado',  'Oscuro',83.0, 58.00, 45.00, 1),
(4, 'Dorado Orgánico Medio',    'Typica',  'Lavado',  'Medio', 84.0, 65.00, 18.00, 1),
(5, 'Sombra Nuez',              'Bourbon', 'Honey',   'Medio', 85.5, 74.00, 12.00, 1),
(6, 'Sendero Frutos Rojos',     'Geisha',  'Natural', 'Claro', 88.5, 95.00,  0.00, 0);

-- metodos_preparacion (4)
INSERT INTO metodos_preparacion (nombre, descripcion, proporcion, temperatura_c, tiempo_seg, molienda, dificultad) VALUES
('Prensa francesa', 'Inmersión que da un cuerpo intenso; fácil de preparar en casa.', '1:15', 94, 240, 'Gruesa', 'Fácil'),
('Filtrado (V60)',  'Goteo que resalta las notas del grano con una taza limpia.',      '1:16', 93, 180, 'Media',  'Intermedia'),
('Espresso',        'Extracción a presión; concentrado y base de muchas bebidas.',     '1:2',  93,  28, 'Fina',   'Avanzada'),
('AeroPress',       'Método versátil de inmersión y presión manual.',                  '1:14', 85, 120, 'Media',  'Fácil');

-- cafeterias_aliadas (4)
INSERT INTO cafeterias_aliadas (id_usuario_resp, nombre, ciudad, direccion, telefono, email, estado, fecha_alianza) VALUES
(3,    'Café Nube',        'Cusco',     'Calle Plateros 120',     '984111001', 'hola@cafenube.com',         'Activa',    '2026-09-10'),
(4,    'Tostadero Altura', 'Arequipa',  'Av. Ejército 455',       '954222002', 'info@tostaderoaltura.com',  'Activa',    '2026-09-12'),
(5,    'Grano & Taza',     'Huancayo',  'Jr. Real 890',           '964333003', 'contacto@granoytaza.com',   'Inactiva',  '2026-09-15'),
(NULL, 'Rincón del Valle', 'Cajamarca', 'Jr. Amazonas 310',       '976444004', NULL,                        'Pendiente', '2026-10-20');

-- cafeteria_grano (8)
INSERT INTO cafeteria_grano (id_cafeteria, id_grano, fecha_inicio) VALUES
(1, 1, '2026-09-15'),
(1, 3, '2026-09-15'),
(1, 5, '2026-09-20'),
(2, 1, '2026-09-18'),
(2, 2, '2026-09-18'),
(2, 7, '2026-10-01'),
(3, 4, '2026-09-20'),
(4, 6, '2026-10-22');

-- mensajes_contacto (6)
INSERT INTO mensajes_contacto (id_usuario_atiende, nombre, email, mensaje, estado, fecha_envio, respuesta, fecha_respuesta) VALUES
(NULL, 'Sofía Mendoza',   'sofia.mendoza@correo.com', '¿Qué molienda recomiendan para prensa francesa?',              'Nuevo',      '2026-10-28 08:45:00', NULL, NULL),
(NULL, 'Diego Ramírez',   'diego.ramirez@correo.com', 'Quisiera unir mi cafetería a la lista de aliadas.',           'Nuevo',      '2026-10-29 14:10:00', NULL, NULL),
(2,    'Paula Vargas',    'paula.vargas@correo.com',  '¿Dónde puedo probar el café de Oxapampa?',                    'En proceso', '2026-10-30 09:30:00', NULL, NULL),
(NULL, 'Jorge Salazar',   'jorge.salazar@correo.com', 'Me interesa una cata para mi equipo de trabajo.',             'Nuevo',      '2026-10-31 17:05:00', NULL, NULL),
(2,    'Karen Torres',    'karen.torres@correo.com',  '¿Cuál es la diferencia entre proceso lavado y natural?',      'Respondido', '2026-10-25 11:00:00',
        'El lavado resalta la acidez y la limpieza; el natural da más dulzor y notas frutales. Pronto lo explicaremos en la web.', '2026-10-26 10:20:00'),
(NULL, 'Luis Fernández',  'luis.fernandez@correo.com','¿Tienen granos orgánicos disponibles?',                       'Nuevo',      '2026-11-01 19:40:00', NULL, NULL);

/* =====================================================================
   4. VISTA 
   ===================================================================== */

CREATE OR REPLACE VIEW vw_catalogo_granos AS
SELECT g.id_grano,
       g.nombre         AS grano,
       g.variedad,
       g.proceso,
       g.tueste,
       g.puntaje_taza,
       g.precio_kg,
       g.stock_kg,
       g.disponible,
       p.nombre         AS productor,
       z.nombre         AS zona_origen,
       z.categoria,
       z.region
FROM granos g
JOIN productores  p ON p.id_productor = g.id_productor
JOIN zonas_origen z ON z.id_zona      = p.id_zona;

/* =====================================================================
   5. PROCEDIMIENTOS ALMACENADOS
   ===================================================================== */

DELIMITER $$

-- ---------------------------------------------------------------------
-- sp_registrar_mensaje
-- Guarda un mensaje enviado desde el formulario de contacto del sitio.
-- Devuelve el id generado en p_id_mensaje.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_registrar_mensaje (
    IN  p_nombre      VARCHAR(80),
    IN  p_email       VARCHAR(100),
    IN  p_mensaje     VARCHAR(1000),
    OUT p_id_mensaje  INT UNSIGNED
)
BEGIN
    IF p_nombre IS NULL OR TRIM(p_nombre) = ''
       OR p_mensaje IS NULL OR TRIM(p_mensaje) = '' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El nombre y el mensaje son obligatorios.';
    END IF;

    IF p_email IS NULL OR p_email NOT LIKE '%_@_%._%' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El correo electrónico no es válido.';
    END IF;

    INSERT INTO mensajes_contacto (nombre, email, mensaje)
    VALUES (TRIM(p_nombre), TRIM(p_email), TRIM(p_mensaje));

    SET p_id_mensaje = LAST_INSERT_ID();
END$$

-- ---------------------------------------------------------------------
-- sp_atender_mensaje
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_atender_mensaje (
    IN p_id_mensaje  INT UNSIGNED,
    IN p_id_usuario  INT UNSIGNED,
    IN p_respuesta   VARCHAR(1000)
)
BEGIN
    DECLARE v_rol    VARCHAR(30);
    DECLARE v_activo TINYINT(1);

    IF p_respuesta IS NULL OR TRIM(p_respuesta) = '' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La respuesta no puede estar vacía.';
    END IF;

    SELECT r.nombre, u.activo
      INTO v_rol, v_activo
      FROM usuarios u
      JOIN roles r ON r.id_rol = u.id_rol
     WHERE u.id_usuario = p_id_usuario;

    IF v_rol IS NULL OR v_activo = 0 OR v_rol NOT IN ('Administrador', 'Editor') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El usuario no existe, está inactivo o no tiene permisos.';
    END IF;

    UPDATE mensajes_contacto
       SET estado             = 'Respondido',
           respuesta          = TRIM(p_respuesta),
           fecha_respuesta    = NOW(),
           id_usuario_atiende = p_id_usuario
     WHERE id_mensaje = p_id_mensaje
       AND estado <> 'Respondido';

    IF ROW_COUNT() = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El mensaje no existe o ya fue respondido.';
    END IF;
END$$

-- ---------------------------------------------------------------------
-- sp_ajustar_stock_grano
-- Registra una entrada (cantidad positiva) o salida (negativa) de stock.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_ajustar_stock_grano (
    IN p_id_grano     INT UNSIGNED,
    IN p_cantidad_kg  DECIMAL(8,2)
)
BEGIN
    IF p_cantidad_kg IS NULL OR p_cantidad_kg = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La cantidad debe ser distinta de cero.';
    END IF;

    -- "disponible" va primero: usa el stock anterior + el ajuste
    UPDATE granos
       SET disponible = IF(stock_kg + p_cantidad_kg > 0, 1, 0),
           stock_kg   = stock_kg + p_cantidad_kg
     WHERE id_grano = p_id_grano
       AND stock_kg + p_cantidad_kg >= 0;

    IF ROW_COUNT() = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El grano no existe o el stock resultante sería negativo.';
    END IF;
END$$

DELIMITER ;
