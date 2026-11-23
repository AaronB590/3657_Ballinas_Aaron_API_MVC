-- Cumbre Café | actualización del proyecto anterior sin perder datos
-- Ejecutar solo si la base original ya existe.
-- No crea ni elimina registros. No cambia nombres de tablas, claves ni relaciones.
-- Amplía el campo para admitir bcrypt; conserva literalmente los hashes previos.
-- Los hashes SHA-256 existentes no se pueden convertir en bcrypt sin conocer
-- la contraseña original. Para usar bcrypt en un registro anterior, asignar
-- una nueva contraseña con PATCH /api/usuarios/:id {"password":"..."}.
-- La API de esta entrega no implementa autenticación ni valida esos hashes.
USE cumbre_cafe;
ALTER TABLE usuarios MODIFY COLUMN password_hash VARCHAR(255) NOT NULL;
