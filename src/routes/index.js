'use strict';

const { Router } = require('express');

const router = Router();

router.use('/roles', require('./rolesRoutes'));
router.use('/usuarios', require('./usuariosRoutes'));
router.use('/zonas-origen', require('./zonasOrigenRoutes'));
router.use('/productores', require('./productoresRoutes'));
router.use('/granos', require('./granosRoutes'));
router.use('/metodos-preparacion', require('./metodosPreparacionRoutes'));
router.use('/cafeterias-aliadas', require('./cafeteriasAliadasRoutes'));
router.use('/cafeteria-grano', require('./cafeteriaGranoRoutes'));
router.use('/mensajes-contacto', require('./mensajesContactoRoutes'));

module.exports = router;
