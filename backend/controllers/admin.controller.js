// controllers/admin.controller.js
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');

/**
 * POST /api/admin/seed-admin
 *
 * Crea el admin inicial. Es idempotente en el sentido estricto: si el correo
 * ya está registrado NO se toca el documento.
 *
 * Antes, si el correo existía, se forzaba `rol: 'admin'` y se reseteaba la
 * contraseña. Eso convertía el endpoint en una toma de control de cualquier
 * cuenta: bastaba con enviar el correo de la víctima. Ahora un usuario
 * existente solo se informa, nunca se modifica.
 */
exports.seedAdmin = async (req, res) => {
  try {
    const defaults = {
      correo: process.env.ADMIN_EMAIL || 'admin@educontrol.com',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      nombre: 'Administrador',
    };
    const { correo, password, nombre } = { ...defaults, ...(req.body || {}) };

    const existente = await Usuario.findOne({ correo });
    if (existente) {
      // Nada que hacer: no tocamos rol ni contraseña de una cuenta ya creada.
      return res.status(200).json({
        ok: true,
        msg: 'El usuario ya existe; no se ha modificado',
        id: existente._id,
        rol: existente.rol,
      });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await Usuario.create({
      nombre,
      correo,
      contraseña: hash,
      rol: 'admin',
    });

    return res
      .status(201)
      .json({ ok: true, msg: 'Admin creado', id: user._id, correo: user.correo });
  } catch (err) {
    console.error('seedAdmin error', err);
    return res.status(500).json({ ok: false, msg: 'Error creando el admin' });
  }
};
