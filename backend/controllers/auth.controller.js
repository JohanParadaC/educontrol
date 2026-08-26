const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

// POST /api/auth/login
const login = async (req, res) => {
  // 👇 Aceptamos cualquiera de estas claves desde el frontend
  const correo = req.body?.correo;
  const pass = req.body?.contraseña ?? req.body?.password ?? req.body?.contrasena;

  if (!correo || !pass) {
    return res.status(400).json({ ok: false, msg: 'Correo y contraseña son obligatorios' });
  }

  try {
    const usuario = await Usuario.findOne({ correo });
    if (!usuario) {
      return res.status(400).json({ ok: false, msg: 'correo no registrado' });
    }

    // ⚠️ En tu schema, la propiedad es "contraseña"
    const validPass = await bcrypt.compare(pass, usuario.contraseña);
    if (!validPass) {
      return res.status(400).json({ ok: false, msg: 'Contraseña incorrecta' });
    }

    const payload = { uid: usuario.id, rol: usuario.rol };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });

    // Nunca devuelvas la contraseña
    res.json({
      ok: true,
      usuario: {
        _id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol,
      },
      token,
    });
  } catch (error) {
    console.error('login error', error);
    res.status(500).json({ ok: false, msg: 'Hable con el administrador' });
  }
};

// GET /api/auth/renew  (o como lo tengas)
const renewToken = async (req, res) => {
  try {
    // 🚩 Lo setea validateJWT
    const { uid, rol } = req;

    const token = jwt.sign({ uid, rol }, process.env.JWT_SECRET, { expiresIn: '12h' });
    const usuario = await Usuario.findById(uid);

    if (!usuario) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });

    res.json({
      ok: true,
      usuario: {
        _id: uid,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol,
      },
      token,
    });
  } catch (err) {
    console.error('renew error', err);
    res.status(500).json({ ok: false, msg: 'Hable con el administrador' });
  }
};

module.exports = { login, renewToken };
