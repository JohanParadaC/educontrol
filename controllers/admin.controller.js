// controllers/admin.controller.js
const bcrypt  = require('bcryptjs');
const Usuario = require('../models/Usuario');

exports.seedAdmin = async (req, res) => {
  try {
    // ⚠️ En producción podrías bloquear esto:
    // if (process.env.NODE_ENV === 'production') { ... }

    // Defaults; puedes override por body si quieres
    const defaults = {
      correo  : 'admin@educontrol.com',
      password: 'admin123',        // ← esta usarás en el login
      nombre  : 'Administrador'
    };
    const { correo, password, nombre } = { ...defaults, ...(req.body || {}) };

    let user = await Usuario.findOne({ correo });
    const hash = await bcrypt.hash(password, 10);

    if (user) {
      // ✅ si ya existe, lo fuerzo a admin y reseteo la contraseña
      user.nombre = nombre;
      user.rol    = 'admin';

      // ⚠️ Usa el nombre de campo REAL de tu schema:
      //   - si en tu modelo se llama "contraseña", deja la siguiente línea:
      user.contraseña = hash;
      //   - si fuera "password", usa en cambio:
      // user.password = hash;

      await user.save();
      return res.status(200).json({ ok: true, msg: 'Admin actualizado', id: user._id });
    }

    // ✅ crear nuevo
    user = await Usuario.create({
      nombre,
      correo,
      // idem: respeta el campo del schema
      contraseña: hash,
      // password: hash,
      rol: 'admin'
    });

    res.status(201).json({ ok: true, msg: 'Admin creado', id: user._id, correo: user.correo });
  } catch (err) {
    console.error('seedAdmin error', err);
    res.status(500).json({ ok: false, msg: 'Error creando/actualizando admin' });
  }
};