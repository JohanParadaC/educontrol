// frontend/server.js
// ---------------------------------------------------------------------------
// Sirve el build de Angular como SPA.
//
// Solo hace falta si quieres alojar el frontend por separado del backend. En el
// arranque normal del proyecto no se usa: el backend sirve estos mismos
// ficheros, y así frontend y API comparten origen (nada de CORS ni URLs
// absolutas).
//
// Nota: la ruta del build es una sola. Antes se probaban once candidatas porque
// `outputPath` en angular.json incluía `browser/` y Angular 20 añade otro por su
// cuenta: el build acababa en `browser/browser`. Arreglado el outputPath, la
// ruta es predecible.
// ---------------------------------------------------------------------------
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const DIST = path.join(__dirname, 'dist', 'educontrol-frontend', 'browser');

app.use(express.static(DIST, { index: false, maxAge: '1h' }));
app.get(/.*/, (_req, res) => res.sendFile(path.join(DIST, 'index.html')));

app.listen(PORT, () => console.log(`✅ Frontend en http://localhost:${PORT}`));
