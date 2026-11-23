'use strict';

const { Router } = require('express');
const controller = require('../controllers/cafeteriaGranoController');

const router = Router();

router.get('/', controller.listar);
router.get('/:id_cafeteria/:id_grano', controller.obtenerPorId);
router.post('/', controller.crear);
router.patch('/:id_cafeteria/:id_grano', controller.actualizar);
router.delete('/:id_cafeteria/:id_grano', controller.eliminar);

module.exports = router;
