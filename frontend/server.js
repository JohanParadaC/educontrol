// frontend/server.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

// Permite forzar la ruta del build si hiciera falta
const ENV_DIST = process.env.FRONTEND_DIST_DIR;

/** Candidatos donde podría quedar el build de Angular */
const candidates = [
  // 👉 override por env
  ...(ENV_DIST ? [ENV_DIST] : []),

  // Angular 17/18 (a veces aparece browser/browser)
  path.join(__dirname, 'dist', 'educontrol-frontend', 'browser', 'browser'),
  path.join(process.cwd(), 'dist', 'educontrol-frontend', 'browser', 'browser'),
  path.join(__dirname, '..', 'dist', 'educontrol-frontend', 'browser', 'browser'),

  // ruta "normal" (browser)
  path.join(__dirname, 'dist', 'educontrol-frontend', 'browser'),
  path.join(process.cwd(), 'dist', 'educontrol-frontend', 'browser'),
  path.join(__dirname, '..', 'dist', 'educontrol-frontend', 'browser'),

  // variantes con “frontend/” duplicado
  path.join(__dirname, 'frontend', 'dist', 'educontrol-frontend', 'browser', 'browser'),
  path.join(__dirname, 'frontend', 'dist', 'educontrol-frontend', 'browser'),
  path.join(process.cwd(), 'frontend', 'dist', 'educontrol-frontend', 'browser', 'browser'),
  path.join(process.cwd(), 'frontend', 'dist', 'educontrol-frontend', 'browser'),
];

/** Revisa si existe un index.html en los candidatos */
function findDist() {
  for (const p of candidates) {
    try {
      const idx = path.join(p, 'index.html');
      if (fs.existsSync(idx)) return p;
    } catch (_) {}
  }
  return null;
}

/** Intenta construir Angular en runtime si falta el dist */
function tryRuntimeBuild() {
  console.warn('⚠️  No se encontró build. Intentando construir en runtime...');
  const ngBin = path.join(__dirname, 'node_modules', '@angular', 'cli', 'bin', 'ng');

  // Si no existe el binario local del CLI, intentamos con npx como último recurso
  if (fs.existsSync(ngBin)) {
    const result = spawnSync('node', [ngBin, 'build', '--configuration', 'production'], {
      cwd: __dirname,
      stdio: 'inherit',
      env: { ...process.env, CI: 'false' },
    });
    return result.status === 0;
  } else {
    const result = spawnSync('npx', ['-y', '@angular/cli', 'build', '--configuration', 'production'], {
      cwd: __dirname,
      stdio: 'inherit',
      env: { ...process.env, CI: 'false' },
    });
    return result.status === 0;
  }
}

// 1) Buscar dist
let DIST_DIR = findDist();

// 2) Si no existe, intentar construir y volver a buscar
if (!DIST_DIR) {
  console.error('❌ No se encontró index.html en:', JSON.stringify(candidates, null, 2));
  const built = tryRuntimeBuild();
  if (built) {
    DIST_DIR = findDist();
  }
}

// 3) Si aún no existe, montar handlers seguros y avisar
if (!DIST_DIR) {
  console.error('❌ No fue posible ubicar el build incluso tras intentar construir.');

  app.get('/healthz', (_req, res) => res.status(200).json({ ok: true, distFound: false }));
  app.get('*', (_req, res) => {
    res
      .status(503)
      .send('No se encontró el build de Angular (index.html). Revisa el proceso de compilación en App Platform.');
  });

  app.listen(PORT, HOST, () => {
    console.log(`🚦 Servidor arriba sin build en http://${HOST}:${PORT}`);
  });
  return;
}

// 4) Servir estáticos y SPA fallback
console.log('📁 Usando DIST_DIR:', DIST_DIR);

app.use(
  express.static(DIST_DIR, {
    index: false,    // importante para que el fallback funcione
    maxAge: '1d',    // cache opcional
  })
);

// Health check
app.get('/healthz', (_req, res) => res.json({ ok: true, distFound: true }));

// Servir index en / y fallback SPA
app.get('/', (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});
app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`✅ Frontend servido en http://${HOST}:${PORT}`);
});