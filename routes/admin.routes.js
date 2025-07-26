// routes/admin.routes.js
const express  = require('express');
const mongoose = require('mongoose');
const router   = express.Router();

router.delete('/purge', async (req, res) => {
  try {
    await mongoose.connection.dropDatabase();
    return res.status(200).send('✅ Base de datos vaciada por completo');
  } catch (err) {
    console.error('Error al purgar DB:', err);
    return res.status(500).send(`❌ Error borrando DB: ${err.message}`);
  }
});

module.exports = router;