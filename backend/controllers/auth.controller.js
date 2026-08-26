const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');
const { firmarToken } = require('../utils/jwt');

/**
 * Hash señuelo: no es la contraseña de nadie.
 *
 * Cuando el correo no existe se compara contra él para gastar el mismo tiempo
 * que una comparación real. `bcrypt.compare` tarda unos 60 ms a propósito; no
 * ejecutarlo cuando el usuario no existe hace que la respuesta llegue mucho
 * antes, y ese tiempo delata qué correos están registrados aunque el mensaje
 * sea idéntico.
 */
const HASH_SENUELO = bcrypt.hashSync('ninguna-contraseña-real-coincide-con-esto', 10);

/** Un solo mensaje para las dos ramas: el correo no existe y la contraseña falla. */
const CREDENCIALES_INVALIDAS = 'Correo o contraseña incorrectos';

// POST /api/auth/login
const login = async (req, res, next) => {
  // 👇 Aceptamos cualquiera de estas claves desde el frontend
  const correo = req.body?.correo;
  const pass = req.body?.contraseña ?? req.body?.password ?? req.body?.contrasena;

  if (!correo || !pass) {
    return res.status(400).json({ ok: false, msg: 'Correo y contraseña son obligatorios' });
  }

  try {
    const usuario = await Usuario.findOne({ correo });

    // Se compara siempre, exista el usuario o no. Antes había dos respuestas
    // distintas —"correo no registrado" y "Contraseña incorrecta"— y con eso
    // se puede averiguar qué correos hay en el sistema sin acertar una sola
    // contraseña.
    const passwordCorrecta = await bcrypt.compare(pass, usuario?.contraseña ?? HASH_SENUELO);

    if (!usuario || !passwordCorrecta) {
      return res.status(401).json({ ok: false, msg: CREDENCIALES_INVALIDAS });
    }

    const token = firmarToken({ uid: usuario.id, rol: usuario.rol });

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
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/renew
const renewToken = async (req, res, next) => {
  try {
    // 🚩 Lo setea validateJWT
    const { uid, rol } = req;

    const usuario = await Usuario.findById(uid);
    if (!usuario) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });

    // El rol se toma del documento, no del claim del token: si a alguien lo
    // han degradado, su token renovado ya no dice que es admin.
    const token = firmarToken({ uid, rol: usuario.rol ?? rol });

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
    next(err);
  }
};

module.exports = { login, renewToken };
