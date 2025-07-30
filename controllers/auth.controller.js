const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

const login = async (req, res) => {
  const { correo, contraseña } = req.body;

  try {
    const usuario = await Usuario.findOne({ correo });
    if (!usuario) {
      return res.status(400).json({ ok: false, msg: 'correo no registrado' });
    }

    const validPass = bcrypt.compareSync(contraseña, usuario.contraseña);
    if (!validPass) {
      return res.status(400).json({ ok: false, msg: 'Contraseña incorrecta' });
    }

    const payload = { uid: usuario.id, rol: usuario.rol };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '2h'
    });

    res.json({
      ok: true,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol
      },
      token
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, msg: 'Hable con el administrador' });
  }
};

const renewToken = async (req, res) => {
  const { uid, rol } = req; // set by validateJWT
  const token = jwt.sign({ uid, rol }, process.env.JWT_SECRET, {
    expiresIn: '2h'
  });
  const usuario = await Usuario.findById(uid);

  res.json({
    ok: true,
    usuario: {
      id: uid,
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: usuario.rol
    },
    token
  });
};

module.exports = { login, renewToken };