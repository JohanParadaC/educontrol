// Express reconoce un manejador de errores por sus cuatro parámetros: `_next`
// no se usa, pero no se puede quitar sin que deje de serlo.
module.exports = (err, req, res, _next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    ok: false,
    msg: err.message || 'Error interno del servidor',
  });
};
