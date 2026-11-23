'use strict';

const { Router } = require('express');
const controller = require('../controllers/cafeteriasAliadasController');

const router = Router();

router.get('/', controller.listar);
router.get('/:id', controller.obtenerPorId);
router.post('/', controller.crear);
router.patch('/:id', controller.actualizar);
router.delete('/:id', controller.eliminar);

module.exports = router;
