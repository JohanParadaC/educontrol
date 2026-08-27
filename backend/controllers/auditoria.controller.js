// controllers/auditoria.controller.js
// ---------------------------------------------------------------------------
// Lectura del registro de acciones administrativas.
//
// Solo se lee. No hay POST, PUT ni DELETE a propósito: un historial que se
// puede editar o borrar desde la propia aplicación no sirve para lo que sirve
// un historial. Las entradas las escriben los controladores a través de
// utils/auditoria.js, y nadie más.
// ---------------------------------------------------------------------------
const Auditoria = require('../models/Auditoria');
const { leerPaginacion, metadatos } = require('../utils/paginacion');
const { escaparRegex } = require('../utils/regex');

/**
 * GET /api/auditoria
 *
 *   ?accion=curso.borrado   una acción concreta
 *   ?buscar=texto           busca en quién lo hizo y sobre qué
 *
 * Paginado como el resto de listados, con el mismo tope duro de 100.
 */
const listarAuditoria = async (req, res, next) => {
  try {
    const { pagina, limite, saltar } = leerPaginacion(req.query);

    const filtro = {};
    if (req.query.accion) filtro.accion = req.query.accion;

    // El texto del usuario es literal, no un patrón: se escapa antes de
    // convertirlo en regex, igual que en el catálogo de cursos.
    const buscar = String(req.query.buscar ?? '').trim();
    if (buscar) {
      const patron = new RegExp(escaparRegex(buscar), 'i');
      filtro.$or = [{ actorNombre: patron }, { 'recurso.etiqueta': patron }];
    }

    const [registros, total] = await Promise.all([
      Auditoria.find(filtro).sort({ createdAt: -1 }).skip(saltar).limit(limite).lean(),
      Auditoria.countDocuments(filtro),
    ]);

    res.json({ ok: true, registros, ...metadatos({ total, pagina, limite }) });
  } catch (err) {
    next(err);
  }
};

module.exports = { listarAuditoria };
