// routes/admin.routes.js
const express  = require('express');
const mongoose = require('mongoose');
const { seedAdmin } = require('../controllers/admin.controller');

const router   = express.Router();

// Herramienta de dev: purgar DB
router.delete('/purge', async (req, res) => {
  try {
    await mongoose.connection.dropDatabase();
    return res.status(200).send('✅ Base de datos vaciada por completo');
  } catch (err) {
    console.error('Error al purgar DB:', err);
    return res.status(500).send(`❌ Error borrando DB: ${err.message}`);
  }
});

// Seed admin
router.post('/seed-admin', seedAdmin);  // POST /api/admin/seed-admin

module.exports = router;