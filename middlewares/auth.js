const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

const validateJWT = async (req, res, next) => {
  // 1) Soportar Authorization: Bearer ...  y x-token (legacy)
  const auth   = req.header('Authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const legacy = req.header('x-token') || '';
  const token  = bearer || legacy;

  if (!token) {
    return res.status(401).json({ ok: false, msg: 'No hay token en la petición' });
  }

  try {
    const { uid, rol } = jwt.verify(token, process.env.JWT_SECRET);

    // 2) Adjuntar datos del usuario al request (muy útil en controladores)
    const usuario = await Usuario.findById(uid).select('-contraseña');
    if (!usuario) {
      return res.status(401).json({ ok: false, msg: 'Token inválido (usuario no existe)' });
    }

    req.usuario = usuario; // ← objeto completo
    req.uid = uid;         // ← compatibilidad con controladores antiguos
    req.rol = rol;

    next();
  } catch (err) {
    return res.status(401).json({ ok: false, msg: 'Token no válido' });
  }
};

module.exports = { validateJWT };