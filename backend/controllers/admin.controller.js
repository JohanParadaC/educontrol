// controllers/admin.controller.js
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');
const { normalizarCorreo } = require('../utils/correo');

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
    const cuerpo = req.body || {};
    const nombre = cuerpo.nombre || 'Administrador';
    const password = cuerpo.password || process.env.ADMIN_PASSWORD;

    // El correo se normaliza UNA vez y ese mismo valor se usa para buscar y
    // para crear. Antes el `findOne` lo normalizaba y el `create` de veinte
    // líneas más abajo lo pasaba en crudo: acababa igual, porque el esquema lo
    // baja a minúsculas, pero el fichero se contradecía a sí mismo.
    const correo = normalizarCorreo(
      cuerpo.correo || process.env.ADMIN_EMAIL || 'admin@educontrol.com'
    );

    // Sin contraseña NO se inventa ninguna.
    //
    // Aquí había un `|| 'admin123'`: una contraseña por defecto escrita en un
    // repositorio público, que es lo mismo que no tener contraseña. La ruta es
    // solo de desarrollo, así que no era una brecha — pero el proyecto ya no
    // tolera eso en ningún sitio: `config/seed.js` se niega a sembrar en
    // producción sin ADMIN_PASSWORD por este mismo razonamiento, y esta era la
    // excepción que quedaba.
    if (!password) {
      return res.status(400).json({
        ok: false,
        msg: 'Falta la contraseña: mándala en el cuerpo o configura ADMIN_PASSWORD.',
      });
    }

    // El mínimo del modelo no vale de guardia: aquí se hashea antes de guardar
    // y el hash siempre mide 60. Es el mismo razonamiento que el del PUT de
    // usuarios, y el mismo número.
    if (String(password).length < 6) {
      return res.status(400).json({
        ok: false,
        msg: 'La contraseña debe tener 6 caracteres mínimo',
      });
    }

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
