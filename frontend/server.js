// frontend/server.js
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// Posibles ubicaciones del build (según cómo empaquete DO)
const CANDIDATES = [
  path.join(__dirname, 'dist', 'educontrol-frontend', 'browser'),
  path.join(__dirname, 'frontend', 'dist', 'educontrol-frontend', 'browser'),
];

// Escoge la primera que exista
const DIST_DIR = CANDIDATES.find(p => fs.existsSync(path.join(p, 'index.html')));
if (!DIST_DIR) {
  console.error('❌ No se encontró index.html en:', CANDIDATES);
}

// Servir archivos estáticos del build
app.use(
  express.static(DIST_DIR || CANDIDATES[0], {
    index: false,      // importante para que el fallback sirva el index
    maxAge: '1d',      // cache opcional
  })
);

// Healthcheck opcional
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Servir index en la raíz explícitamente
app.get('/', (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

// Fallback SPA: cualquier ruta (que no sea archivo) devuelve index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

// DO expone PORT; local usa 8080
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`✅ Frontend servido en http://${HOST}:${PORT}`);
  console.log('📁 Usando DIST_DIR:', DIST_DIR);
});