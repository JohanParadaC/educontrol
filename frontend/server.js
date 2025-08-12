// frontend/server.js
const express = require('express');
const path = require('path');

const app = express();

// carpeta generada por: ng build --configuration production
const DIST_DIR = path.join(__dirname, 'dist', 'educontrol-frontend', 'browser');

// servir archivos estáticos
app.use(express.static(DIST_DIR, {
  maxAge: '1d', // opcional: cache estática
}));

// Fallback SPA: cualquier ruta devuelve index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

// DO expone PORT; local usa 8080
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`✅ Frontend servido en http://${HOST}:${PORT}`);
});