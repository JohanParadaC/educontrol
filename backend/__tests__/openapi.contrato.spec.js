// __tests__/openapi.contrato.spec.js
// ---------------------------------------------------------------------------
// `openapi.yaml` está escrito a mano, y un documento escrito a mano que nadie
// comprueba envejece en dos semanas: alguien añade una ruta, nadie toca el
// YAML, y a partir de ahí la documentación miente con toda la confianza del
// mundo.
//
// Esto lo compara con la realidad: recorre la tabla de routers de app.js —la
// misma con la que se montan— y exige que cada operación esté documentada y
// que cada operación documentada exista.
// ---------------------------------------------------------------------------
const app = require('../app');
const { leerOpenApi } = require('../docs');

/** `/api/cursos/:id` (Express) → `/api/cursos/{id}` (OpenAPI). */
const aOpenApi = ruta => ruta.replace(/:([A-Za-z0-9_]+)/g, '{$1}');

/**
 * Todas las operaciones que la aplicación monta de verdad, como
 * `GET /api/cursos/{id}`.
 */
function operacionesReales() {
  const salida = new Set();

  for (const { base, router } of app.RUTAS_API) {
    for (const capa of router.stack) {
      if (!capa.route) continue;
      const sufijo = capa.route.path === '/' ? '' : capa.route.path;
      const ruta = aOpenApi(base + sufijo) || '/';

      for (const [metodo, activo] of Object.entries(capa.route.methods)) {
        if (activo) salida.add(`${metodo.toUpperCase()} ${ruta}`);
      }
    }
  }

  // `/api/admin/boom` solo se monta con NODE_ENV=test: existe para cubrir el
  // manejador de errores y no forma parte de la API.
  salida.delete('GET /api/admin/boom');
  return salida;
}

/** Todas las operaciones que el documento describe. */
function operacionesDocumentadas(documento) {
  const salida = new Set();
  const METODOS = ['get', 'post', 'put', 'patch', 'delete'];

  for (const [ruta, item] of Object.entries(documento.paths)) {
    for (const metodo of METODOS) {
      if (item[metodo]) salida.add(`${metodo.toUpperCase()} ${ruta}`);
    }
  }
  return salida;
}

describe('openapi.yaml describe la API que existe', () => {
  const documento = leerOpenApi();
  const reales = operacionesReales();
  const documentadas = operacionesDocumentadas(documento);

  it('el documento se parsea y dice ser OpenAPI 3', () => {
    expect(documento.openapi).toMatch(/^3\./);
    expect(documento.info.title).toBeTruthy();
    expect(Object.keys(documento.paths).length).toBeGreaterThan(10);
  });

  it('no hay rutas montadas sin documentar', () => {
    const sinDocumentar = [...reales].filter(op => !documentadas.has(op)).sort();
    expect(sinDocumentar).toEqual([]);
  });

  it('no hay rutas documentadas que no existan', () => {
    const inventadas = [...documentadas].filter(op => !reales.has(op)).sort();
    expect(inventadas).toEqual([]);
  });

  it('cada operación tiene operationId, y son únicos', () => {
    const ids = [];
    for (const item of Object.values(documento.paths)) {
      for (const metodo of ['get', 'post', 'put', 'patch', 'delete']) {
        if (item[metodo]) {
          expect(item[metodo].operationId).toBeTruthy();
          ids.push(item[metodo].operationId);
        }
      }
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lo que pide token lo dice, y lo público lo dice también', () => {
    // La seguridad por defecto es el bearer; las rutas públicas la anulan con
    // `security: []`. Si alguna pública se olvidara, el documento diría que
    // hace falta token para registrarse.
    const publicas = [
      ['/api/health', 'get'],
      ['/api/health/live', 'get'],
      ['/api/health/ready', 'get'],
      ['/api/auth/login', 'post'],
      ['/api/usuarios', 'post'],
      ['/api/admin/seed-admin', 'post'],
    ];

    expect(documento.security).toEqual([{ bearerAuth: [] }]);

    for (const [ruta, metodo] of publicas) {
      expect(documento.paths[ruta][metodo].security).toEqual([]);
    }

    // Y una que sí lo pide no lleva anulación.
    expect(documento.paths['/api/auditoria'].get.security).toBeUndefined();
  });

  it('los parámetros de ruta declarados coinciden con los de la plantilla', () => {
    for (const [ruta, item] of Object.entries(documento.paths)) {
      const enPlantilla = [...ruta.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);
      if (!enPlantilla.length) continue;

      const declarados = new Set();
      const recoger = params => {
        for (const p of params ?? []) {
          const nombre = p.$ref ? p.$ref.split('/').pop().toLowerCase() : p.name;
          declarados.add(nombre);
        }
      };

      recoger(item.parameters);
      for (const metodo of ['get', 'post', 'put', 'patch', 'delete']) {
        if (item[metodo]) recoger(item[metodo].parameters);
      }

      for (const nombre of enPlantilla) {
        expect(declarados.has(nombre)).toBe(true);
      }
    }
  });
});
