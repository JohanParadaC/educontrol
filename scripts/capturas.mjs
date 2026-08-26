// scripts/capturas.mjs
// ---------------------------------------------------------------------------
// Genera las capturas de docs/ contra la app corriendo en local.
//
// Uso:
//   1) npm run serve        (en otra terminal, deja la app en :3000)
//   2) node scripts/capturas.mjs
//
// Usa Chrome headless por el DevTools Protocol. Sin dependencias: Node 22 ya
// trae fetch y WebSocket. La gracia de tenerlo como script y no a mano es que
// las capturas se regeneran cuando cambia la interfaz, en vez de envejecer.
// ---------------------------------------------------------------------------
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = join(RAIZ, 'docs');
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PUERTO_CDP = 9222;

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(p => p && existsSync(p));

/** Pantallas a capturar. `preparar` deja la app en el estado que queremos. */
const PANTALLAS = [
  {
    fichero: '00-portada.png',
    titulo: 'Portada pública',
    ruta: '/',
    ancho: 1280,
    alto: 900,
  },
  {
    fichero: '01-login.png',
    titulo: 'Inicio de sesión',
    ruta: '/login',
    ancho: 1280,
    alto: 900,
  },
  {
    fichero: '02-admin.png',
    titulo: 'Panel de administración',
    ruta: '/login',
    ancho: 1280,
    alto: 1000,
    preparar: entrarComo('admin@educontrol.com', 'Admin123*'),
  },
  {
    fichero: '03-profesor.png',
    titulo: 'Vista de profesor',
    ruta: '/login',
    ancho: 1280,
    alto: 900,
    preparar: entrarComo('lucia@educontrol.com', 'Demo1234'),
  },
  {
    fichero: '04-estudiante.png',
    titulo: 'Catálogo de cursos (estudiante)',
    ruta: '/login',
    ancho: 1280,
    alto: 900,
    preparar: entrarComo('ana@educontrol.com', 'Demo1234'),
  },
  {
    fichero: '05-movil-login.png',
    titulo: 'Login en móvil',
    ruta: '/login',
    ancho: 390,
    alto: 844,
  },
  {
    fichero: '06-movil-admin.png',
    titulo: 'Panel de administración en móvil (tarjetas)',
    ruta: '/login',
    ancho: 390,
    alto: 844,
    preparar: entrarComo('admin@educontrol.com', 'Admin123*'),
  },
];

/** Devuelve un script que rellena el login y espera a salir de /login. */
function entrarComo(correo, password) {
  return `
    (async () => {
      const esperar = ms => new Promise(r => setTimeout(r, ms));
      const set = (el, v) => {
        const proto = Object.getPrototypeOf(el);
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      for (let i = 0; i < 40 && !document.querySelector('input[type=email]'); i++) await esperar(100);
      set(document.querySelector('input[type=email]'), ${JSON.stringify(correo)});
      set(document.querySelector('input[type=password]'), ${JSON.stringify(password)});
      await esperar(100);
      document.querySelector('button[type=submit]').click();
      for (let i = 0; i < 60 && location.pathname.includes('login'); i++) await esperar(100);
      await esperar(1200);
      return location.pathname;
    })()
  `;
}

// --- CDP mínimo ------------------------------------------------------------
let siguienteId = 0;
function crearCliente(ws) {
  const pendientes = new Map();
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pendientes.has(msg.id)) {
      pendientes.get(msg.id)(msg);
      pendientes.delete(msg.id);
    }
  });
  return (method, params = {}) =>
    new Promise(resolve => {
      const id = ++siguienteId;
      pendientes.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
}

async function main() {
  if (!CHROME) {
    console.error('❌ No encuentro Chrome. Instálalo o pasa la ruta en el script.');
    process.exit(1);
  }

  try {
    const salud = await fetch(`${BASE}/api/health`);
    if (!salud.ok) throw new Error();
  } catch {
    console.error(`❌ La app no responde en ${BASE}. Arráncala con "npm run serve".`);
    process.exit(1);
  }

  await mkdir(DESTINO, { recursive: true });

  const perfil = join(RAIZ, '.chrome-capturas');
  const chrome = spawn(
    CHROME,
    [
      `--remote-debugging-port=${PUERTO_CDP}`,
      `--user-data-dir=${perfil}`,
      '--headless=new',
      '--hide-scrollbars',
      '--no-first-run',
      '--force-device-scale-factor=2', // capturas nítidas para el README
    ],
    { stdio: 'ignore' }
  );

  // Esperar a que el puerto de depuración responda
  let objetivo = null;
  for (let i = 0; i < 50 && !objetivo; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PUERTO_CDP}/json/list`);
      objetivo = (await r.json()).find(t => t.type === 'page');
    } catch {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  if (!objetivo) {
    chrome.kill();
    throw new Error('Chrome no expuso el puerto de depuración');
  }

  const ws = new WebSocket(objetivo.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  const enviar = crearCliente(ws);

  await enviar('Page.enable');
  await enviar('Runtime.enable');

  for (const p of PANTALLAS) {
    await enviar('Emulation.setDeviceMetricsOverride', {
      width: p.ancho,
      height: p.alto,
      deviceScaleFactor: 2,
      mobile: p.ancho < 700,
    });

    // Sesión limpia entre capturas
    await enviar('Runtime.evaluate', {
      expression: 'try{localStorage.clear();sessionStorage.clear()}catch(e){}',
    });
    await enviar('Page.navigate', { url: `${BASE}${p.ruta}` });
    await new Promise(r => setTimeout(r, 1500));

    if (p.preparar) {
      await enviar('Runtime.evaluate', { expression: p.preparar, awaitPromise: true });
    }
    await new Promise(r => setTimeout(r, 600));

    const { result } = await enviar('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(DESTINO, p.fichero), Buffer.from(result.data, 'base64'));
    console.log(`📸 ${p.fichero.padEnd(22)} ${p.titulo}`);
  }

  ws.close();
  chrome.kill();

  // En Windows Chrome mantiene algún fichero del perfil bloqueado un instante
  // tras morir. No es motivo para fallar: las capturas ya están escritas.
  await new Promise(r => setTimeout(r, 500));
  await rm(perfil, { recursive: true, force: true }).catch(() => {});

  console.log(`\n✅ Capturas en ${DESTINO}`);
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
