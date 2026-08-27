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
// La portada enseña una captura real del panel, así que esa imagen no es
// documentación: es un asset del frontend y se sirve con la aplicación.
const PUBLICO = join(RAIZ, 'frontend', 'public');
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PUERTO_CDP = 9222;

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(p => p && existsSync(p));

/**
 * Pantallas a capturar. `preparar` deja la app en el estado que queremos.
 *
 * Por defecto van a docs/ en PNG a escala 2 —nítidas para el README—, pero se
 * puede mandar una a otra `carpeta`, en otro `formato` y a otra `escala`: la
 * del héroe de la portada se descarga de verdad y ahí el peso sí importa.
 */
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
  {
    // La misma pantalla en oscuro. El sistema de diseño se ve entero aquí y
    // así el modo oscuro deja de ser una promesa del README.
    fichero: '07-admin-oscuro.png',
    titulo: 'Panel de administración en modo oscuro',
    ruta: '/login',
    ancho: 1280,
    alto: 900,
    tema: 'dark',
    preparar: entrarComo('admin@educontrol.com', 'Admin123*'),
  },

  {
    // La ficha de un curso, vista por quien lo imparte: es la única pantalla
    // donde se ve la lista de matriculados.
    //
    // No se navega a /cursos/<id> directamente porque el identificador cambia
    // en cada arranque con la base en memoria: se entra por "Mis clases" y se
    // pulsa la primera tarjeta, que es como llega una persona.
    fichero: '08-curso.png',
    titulo: 'Ficha de curso (profesor)',
    ruta: '/login',
    ancho: 1280,
    alto: 900,
    preparar: `
      (async () => {
        await ${entrarComo('lucia@educontrol.com', 'Demo1234')};
        const esperar = ms => new Promise(r => setTimeout(r, ms));
        // Se navega pulsando, no con location.href: una recarga de página mata
        // este script a la mitad y la captura sale en la pantalla anterior.
        const menu = Array.from(document.querySelectorAll('a.destino'))
          .find(a => /Mis clases/.test(a.textContent));
        menu.click();
        for (let i = 0; i < 60 && !document.querySelector('a.course'); i++) await esperar(100);
        document.querySelector('a.course').click();
        for (let i = 0; i < 60 && !document.querySelector('.ficha'); i++) await esperar(100);
        await esperar(800);
        return location.pathname;
      })()
    `,
  },

  {
    // El registro de acciones administrativas, que vive al final del panel.
    // Se baja hasta él en vez de capturar la página entera: lo que interesa
    // es la tabla, no los mil píxeles que hay por encima.
    fichero: '09-actividad.png',
    titulo: 'Registro de actividad (administración)',
    ruta: '/login',
    ancho: 1280,
    alto: 820,
    preparar: `
      (async () => {
        await ${entrarComo('admin@educontrol.com', 'Admin123*')};
        const esperar = ms => new Promise(r => setTimeout(r, ms));
        for (let i = 0; i < 80 && !document.querySelector('.actividad table'); i++) {
          await esperar(100);
        }
        const seccion = document.querySelector('.actividad');
        window.scrollTo({ top: seccion.getBoundingClientRect().top + window.scrollY - 72 });
        await esperar(600);
        return location.pathname;
      })()
    `,
  },

  {
    // La documentación de la API. No es una pantalla de la aplicación, así que
    // se espera a un selector suyo y no al contenedor de la SPA.
    fichero: '10-api-docs.png',
    titulo: 'Documentación de la API (OpenAPI)',
    ruta: '/api/docs/',
    selector: '.swagger-ui .opblock',
    ancho: 1280,
    alto: 900,
  },

  // --- Assets de la portada ---------------------------------------------
  // El héroe enseña el panel de verdad. Van en webp y a escala 1 porque estas
  // dos sí las descarga quien abre la página —son el LCP de la portada—, y en
  // el hueco más ancho que tiene el héroe la imagen se pinta a unos 570 px:
  // 1280 de origen ya sobran para una pantalla de doble densidad. La misma
  // captura en PNG a escala 2 pesa 250 kB.
  //
  // Dos ficheros y no uno: en oscuro, una captura blanca de 1280 px es una
  // linterna. El <picture> de la portada elige según prefers-color-scheme.
  {
    fichero: 'captura-panel.webp',
    carpeta: PUBLICO,
    formato: 'webp',
    calidad: 82,
    escala: 1,
    titulo: 'Panel para el héroe de la portada',
    ruta: '/login',
    ancho: 1280,
    alto: 860,
    preparar: entrarComo('admin@educontrol.com', 'Admin123*'),
  },
  {
    fichero: 'captura-panel-oscuro.webp',
    carpeta: PUBLICO,
    formato: 'webp',
    calidad: 82,
    escala: 1,
    titulo: 'Panel para el héroe, en oscuro',
    ruta: '/login',
    ancho: 1280,
    alto: 860,
    tema: 'dark',
    preparar: entrarComo('admin@educontrol.com', 'Admin123*'),
  },
];

/**
 * Espera a que Angular haya pintado la página, en vez de dormir a ciegas.
 *
 * La portada salía en blanco: es la primera captura de la tanda, o sea la que
 * paga el arranque en frío, y 1500 ms no le llegaban.
 */
const esperarPintado = (selector = 'main.pagina') => `
  (async () => {
    const esperar = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 100; i++) {
      const nodo = document.querySelector(${JSON.stringify(selector)});
      if (nodo && nodo.textContent.trim()) return true;
      await esperar(100);
    }
    return false;
  })()
`;

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
    // El tema se fija a mano en cada captura. Sin esto, Chrome hereda el
    // esquema del sistema y las mismas capturas salen claras u oscuras según
    // quién las regenere.
    // Y de paso se pide "menos movimiento": las animaciones de entrada de la
    // portada dejaban la captura a medio camino según lo que tardara el
    // arranque. Además comprueba que con esa preferencia no se queda nada
    // invisible, que es el fallo clásico de animar con opacidad.
    await enviar('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-color-scheme', value: p.tema ?? 'light' },
        { name: 'prefers-reduced-motion', value: 'reduce' },
      ],
    });

    await enviar('Emulation.setDeviceMetricsOverride', {
      width: p.ancho,
      height: p.alto,
      deviceScaleFactor: p.escala ?? 2,
      mobile: p.ancho < 700,
    });

    // Sesión limpia entre capturas
    await enviar('Runtime.evaluate', {
      expression: 'try{localStorage.clear();sessionStorage.clear()}catch(e){}',
    });
    await enviar('Page.navigate', { url: `${BASE}${p.ruta}` });
    await enviar('Runtime.evaluate', {
      expression: esperarPintado(p.selector),
      awaitPromise: true,
    });
    await new Promise(r => setTimeout(r, 600));

    if (p.preparar) {
      await enviar('Runtime.evaluate', { expression: p.preparar, awaitPromise: true });
    }
    await new Promise(r => setTimeout(r, 600));

    const { result } = await enviar('Page.captureScreenshot', {
      format: p.formato ?? 'png',
      ...(p.calidad ? { quality: p.calidad } : {}),
    });
    await writeFile(join(p.carpeta ?? DESTINO, p.fichero), Buffer.from(result.data, 'base64'));
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
