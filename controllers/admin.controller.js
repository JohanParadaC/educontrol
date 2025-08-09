// controllers/admin.controller.js
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');

exports.seedAdmin = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ ok: false, msg: 'Seed deshabilitado en producción' });
    }

    const {
      correo = 'admin@educontrol.com',
      password = 'Admin123*',
      nombre = 'Administrador'
    } = req.body || {};

    let user = await Usuario.findOne({ correo });

    if (user) {
      return res.status(200).json({ ok: true, msg: 'Admin ya existe', id: user._id });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    user = await Usuario.create({
      nombre,
      correo,
      contraseña: hash,
      rol: 'admin'
    });

    res.status(201).json({ ok: true, msg: 'Admin creado', id: user._id, correo: user.correo });
  } catch (err) {
    next(err);
  }
};