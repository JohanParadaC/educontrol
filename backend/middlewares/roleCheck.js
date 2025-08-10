const roleCheck = (...permittedRoles) => {
  return (req, res, next) => {
    if (!permittedRoles.includes(req.rol)) {
      return res.status(403).json({ ok: false, msg: 'Permiso denegado' });
    }
    next();
  };
};

module.exports = { roleCheck };