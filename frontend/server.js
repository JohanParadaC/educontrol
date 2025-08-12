// frontend/server.js
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// carpeta correcta del build de Angular:
const distDir = path.join(__dirname, 'dist', 'educontrol-frontend', 'browser');

// archivos estáticos con cache razonable
app.use(express.static(distDir, { maxAge: '1h' }));

// fallback SPA: cualquier ruta devuelve index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Frontend sirviendo ${distDir} en puerto ${PORT}`);
});