const jwt = require('jsonwebtoken');

const validateJWT = (req, res, next) => {
  const token = req.header('x-token');
  if (!token) {
    return res.status(401).json({ ok: false, msg: 'No hay token en la petición' });
  }
  try {
    const { uid, rol } = jwt.verify(token, process.env.JWT_SECRET);
    req.uid = uid;
    req.rol = rol;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, msg: 'Token no válido' });
  }
};

module.exports = { validateJWT };