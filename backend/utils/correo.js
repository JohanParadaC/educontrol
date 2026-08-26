// utils/correo.js
// ---------------------------------------------------------------------------
// El modelo guarda el correo en minúsculas y sin espacios (lowercase + trim).
// Cualquier búsqueda por correo tiene que aplicar el mismo criterio, o quien se
// registró como "Ana@x.com" no encuentra su cuenta escribiendo "ana@x.com".
//
// Vive aquí, en un solo sitio, para que la regla no se escriba de tres formas
// distintas en tres controladores.
// ---------------------------------------------------------------------------

const normalizarCorreo = (correo = '') => String(correo).trim().toLowerCase();

module.exports = { normalizarCorreo };
