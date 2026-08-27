// routes/health.routes.js
const { Router } = require('express');
const { vivo, listo } = require('../controllers/health.controller');

const router = Router();

// Sin JWT y sin límite de peticiones: las sondas las llama el orquestador cada
// pocos segundos y no tiene credenciales que dar. No exponen nada — el estado
// de la conexión no es un secreto y saberlo es justo para lo que existen.
router.get('/', listo);
router.get('/live', vivo);
router.get('/ready', listo);

module.exports = router;
