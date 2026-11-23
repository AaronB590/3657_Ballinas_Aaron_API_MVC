'use strict';

const bcrypt = require('bcryptjs');

// El controlador recibe la contraseña; el modelo recibe únicamente su hash.
async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

module.exports = { hashPassword };
