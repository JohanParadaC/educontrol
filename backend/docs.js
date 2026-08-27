// backend/docs.js
// ---------------------------------------------------------------------------
// La documentación de la API, servida en /api/docs.
//
// Dos decisiones que explican la forma de este fichero:
//
// 1. **Solo fuera de producción.** Y aquí, a diferencia de las herramientas
//    de `/api/admin`, la puerta NO es fail-closed: si `NODE_ENV` no está
//    definida, la documentación sí se monta. La razón es que `npm run serve`
//    no la define, y una puerta fail-closed dejaría la documentación
//    inalcanzable justo donde se usa. El riesgo tampoco es el mismo: publicar
//    el mapa de la API no destruye nada, mientras que `/api/admin/purge` vacía
//    la base.
//
//    Lo que sí es fail-closed es lo de abajo.
//
// 2. **`swagger-ui-express` y `yaml` son devDependencies**, y se cargan con un
//    `require` perezoso dentro de un try. La imagen de producción se instala
//    con `--omit=dev`, así que allí no están: aunque alguien arrancase esa
//    imagen sin `NODE_ENV`, la documentación no se podría montar ni queriendo.
//    Dos cerraduras distintas, y la segunda no depende de una variable.
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');

const RUTA_OPENAPI = path.join(__dirname, 'openapi.yaml');

/** Lee y parsea el contrato. Se exporta para poder comprobarlo en los tests. */
function leerOpenApi() {
  const { parse } = require('yaml');
  return parse(fs.readFileSync(RUTA_OPENAPI, 'utf8'));
}

/**
 * Monta Swagger UI en /api/docs.
 * @returns {boolean} si llegó a montarse
 */
function montarDocumentacion(app) {
  if (process.env.NODE_ENV === 'production') return false;

  try {
    const swaggerUi = require('swagger-ui-express');
    const documento = leerOpenApi();

    app.use(
      '/api/docs',
      swaggerUi.serve,
      swaggerUi.setup(documento, {
        customSiteTitle: 'EduControl · API',
        swaggerOptions: { docExpansion: 'list', defaultModelsExpandDepth: -1 },
      })
    );

    // El YAML en crudo, para quien quiera generar un cliente o pasarle un
    // linter sin clonar el repositorio.
    app.get('/api/openapi.yaml', (_req, res) => {
      res.type('text/yaml').sendFile(RUTA_OPENAPI);
    });

    return true;
  } catch (err) {
    // Sin las devDependencies instaladas no hay documentación, y ya está: no
    // es motivo para que el servidor no arranque.
    console.warn('ℹ️  Documentación de la API no montada:', err.message);
    return false;
  }
}

module.exports = { montarDocumentacion, leerOpenApi, RUTA_OPENAPI };
