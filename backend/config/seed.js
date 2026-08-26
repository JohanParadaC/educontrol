// config/seed.js
// ---------------------------------------------------------------------------
// Sembrado del administrador inicial.
//
// Vivía dentro de app.js, que por eso importaba bcrypt y un modelo de Mongoose
// solo para esto. Un fichero que monta rutas de Express no tiene por qué saber
// cómo se hashea una contraseña.
// ---------------------------------------------------------------------------
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');

/**
 * Crea el administrador inicial si no existe. Idempotente.
 * En producción exige ADMIN_PASSWORD: una contraseña por defecto conocida en un
 * repositorio público equivale a no tener contraseña.
 */
async function ensureAdminSeed() {
  try {
    const correo = process.env.ADMIN_EMAIL || 'admin@educontrol.com';
    const plainPassword = process.env.ADMIN_PASSWORD || 'Admin123*';

    if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
      console.warn('⚠️  ADMIN_PASSWORD no configurada: se omite el seed del admin.');
      return;
    }

    const exists = await Usuario.findOne({ correo }).lean();
    if (exists) {
      console.log(`ℹ️  Admin ya existe: ${correo}`);
      return;
    }

    const hash = await bcrypt.hash(plainPassword, 10);
    await Usuario.create({
      nombre: 'Admin',
      correo,
      ['contraseña']: hash, // el campo del schema lleva tilde
      rol: 'admin',
    });

    console.log(`✅ Admin creado: ${correo}`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`   contraseña: ${plainPassword}`);
    }
  } catch (err) {
    console.error('❌ Error creando admin:', err);
  }
}

module.exports = { ensureAdminSeed };
