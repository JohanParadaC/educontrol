/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',

  // Se ejecuta después de cargar Jest (hooks globales, set de envs, etc.)
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Acepta *.spec.js y *.test.js dentro de __tests__/
  testMatch: ['**/__tests__/**/*.(spec|test).js'],

  // Qué archivos cuentan para cobertura
  // ⬇️ CAMBIO: quitamos app.js del cómputo (solo arranque de servidor) para no penalizar cobertura.
  collectCoverageFrom: [
    'config/**/*.js',
    'controllers/**/*.js',
    'middlewares/**/*.js',
    'models/**/*.js',
    'routes/**/*.js',

    // Excluimos directorios típicos
    '!**/node_modules/**',
    '!**/coverage/**',
  ],

  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // Umbrales ajustados a la cobertura real, medida con `npm run test:cov`:
  // 91,07 sentencias / 84,15 ramas / 100 funciones / 92,37 líneas.
  // (Los tests de control de acceso de agosto de 2026 subieron las ramas casi
  // ocho puntos, y los cuatro cabos sueltos del cierre de la auditoría otros
  // siete: cada regla nueva es una rama que antes no se recorría.)
  //
  // Estaban en 82/68/95/84, por encima de dos de esas cifras: `test:cov`
  // fallaba desde antes de que existiera la integración continua, y como
  // `npm test` corre sin --coverage nadie se enteraba. Ahora van medio punto
  // por debajo de lo real: lo bastante cerca para que borrar tests duela,
  // lo bastante lejos para no saltar por ruido.
  //
  // (Antes de eso iban en 70/50/65/70, muy por debajo de lo que se cubría:
  // un umbral que va por detrás de la realidad no protege de nada.)
  coverageThreshold: {
    global: {
      statements: 89,
      branches: 82,
      functions: 99,
      lines: 90,
    },
  },

  verbose: true,
};
