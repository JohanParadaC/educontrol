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

  // Umbrales ajustados a la cobertura real (85 / 73 / 100 / 87), con unos
  // puntos de margen para que no salte por ruido.
  //
  // Antes iban en 70/50/65/70, muy por debajo de lo que se cubría: un umbral
  // que va por detrás de la realidad no protege de nada, porque se puede
  // borrar media suite sin que nadie se entere.
  coverageThreshold: {
    global: {
      statements: 82,
      branches:   68,
      functions:  95,
      lines:      84,
    },
  },

  verbose: true,
};