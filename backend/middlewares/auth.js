const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

const validateJWT = async (req, res, next) => {
  // Una sola vía: Authorization: Bearer.
  //
  // También se aceptaba `x-token`, y el interceptor del frontend mandaba las
  // dos cabeceras con el mismo valor. Dos puertas para lo mismo es el doble de
  // superficie y el doble de sitios donde equivocarse.
  const auth = req.header('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

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
    req.uid = uid; // ← compatibilidad con controladores antiguos
    req.rol = rol;

    next();
  } catch {
    return res.status(401).json({ ok: false, msg: 'Token no válido' });
  }
};

module.exports = { validateJWT };
