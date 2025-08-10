const jwt = require('jsonwebtoken');
const generarJWT = (uid, rol) => {
  return jwt.sign({ uid, rol }, process.env.JWT_SECRET, { expiresIn: '2h' });
};
module.exports = generarJWT;