// backend/static.js
// ---------------------------------------------------------------------------
// Servido de la SPA de Angular desde el propio backend.
//
// Un solo proceso y un solo origen: por eso `apiBase: '/api'` (relativo) es
// correcto en el frontend y no hacen falta CORS ni una URL absoluta.
//
// Estaba mezclado dentro de app.js junto al montaje de rutas, el sembrado del
// admin y el arranque del servidor. Aquí es una pieza con un solo cometido.
// ---------------------------------------------------------------------------
const express = require('express');
const path = require('path');
const fs = require('fs');

const DIST_POR_DEFECTO = path.join(
  __dirname, '..', 'frontend', 'dist', 'educontrol-frontend', 'browser'
);

/** Ruta del build de Angular; `FRONTEND_DIST` la sobreescribe. */
const rutaDist = () => process.env.FRONTEND_DIST || DIST_POR_DEFECTO;

/** ¿Hay un build servible? Si no, la API funciona igual y esto no se monta. */
const hayBuild = () => fs.existsSync(path.join(rutaDist(), 'index.html'));

/**
 * Monta el servido de estáticos y el fallback de la SPA sobre la app dada.
 * @returns {boolean} si llegó a montarse
 */
function montarFrontend(app) {
  if (!hayBuild()) return false;
  const DIST = rutaDist();

  // Los ficheros llevan hash en el nombre: son inmutables y se cachean a lo
  // bruto. Cambiar el contenido cambia el nombre.
  app.use(express.static(DIST, {
    index: false,
    maxAge: '1y',
    immutable: true,
    // ⚠️ index.html es la excepción: es quien apunta a los ficheros con hash.
    // Si se cachea, tras un despliegue el navegador sigue pidiendo los chunks
    // de la versión anterior, que ya no existen, y la aplicación se rompe con
    // "Failed to fetch dynamically imported module".
    setHeaders: (res, ruta) => {
      if (ruta.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
    }
  }));

  // Fallback de la SPA: cualquier ruta que no sea de API devuelve el index.
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api')) return next(); // deja pasar los 404 de API
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(DIST, 'index.html'));
  });

  return true;
}

module.exports = { montarFrontend, hayBuild };
