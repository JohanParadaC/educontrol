module.exports = (err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    ok: false,
    msg: err.message || 'Error interno del servidor'
  });
};