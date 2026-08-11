/**
 * Autoriza por rol.
 *
 * Usa el rol del documento cargado por validateJWT (estado actual en base de
 * datos) y solo cae al claim del token como respaldo. Fiarse únicamente del
 * token significa que un usuario degradado conserva sus permisos hasta que el
 * JWT caduca (12 h).
 */
const roleCheck = (...permittedRoles) => {
  return (req, res, next) => {
    const rol = req.usuario?.rol ?? req.rol;
    if (!permittedRoles.includes(rol)) {
      return res.status(403).json({ ok: false, msg: 'Permiso denegado' });
    }
    next();
  };
};

module.exports = { roleCheck };
