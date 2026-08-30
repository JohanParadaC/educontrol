// karma.conf.js
// ---------------------------------------------------------------------------
// Existe por los umbrales de cobertura.
//
// Hasta ahora no había fichero: el builder `@angular/build:karma` trae su
// propia configuración y funcionaba sin tocar nada. Pero en cuanto se le pasa
// uno, deja de poner la suya —incluido `frameworks: ['jasmine']`, sin el cual
// los specs revientan con "describe is not defined"—, así que hay que
// escribirla entera aunque lo único que interese sea el bloque `check`.
//
// La idea es la misma que en backend/jest.config.js: los umbrales van un par
// de puntos por debajo de la cobertura real. Lo bastante cerca para que borrar
// tests duela, lo bastante lejos para no saltar por ruido.
//
// Medido con `npm run test:web:cov` sobre 220 tests:
//   85,83 sentencias · 67,84 ramas · 84,94 funciones · 87,73 líneas.
//
// Las ramas eran las que iban muy por detrás —47 %— y ese sí era el siguiente
// trabajo: los dos diálogos de administración no tenían un solo test, la barra
// de navegación tenía un `should create`, y login, register y tres servicios de
// datos estaban a cero o casi. Cubrirlos subió las ramas veinte puntos.
// ---------------------------------------------------------------------------
const { join } = require('node:path');

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
    ],
    client: {
      // El informe de Jasmine se queda en pantalla al terminar, para poder
      // pinchar en un test concreto cuando se ejecuta en modo vigilancia.
      clearContext: false,
    },
    jasmineHtmlReporter: { suppressAll: true },

    coverageReporter: {
      dir: join(__dirname, 'coverage'),
      subdir: 'educontrol-frontend',
      reporters: [{ type: 'html' }, { type: 'text-summary' }, { type: 'json-summary' }],
      check: {
        global: {
          statements: 83,
          branches: 65,
          functions: 82,
          lines: 85,
        },
      },
    },

    reporters: ['progress', 'kjhtml'],
    browsers: ['Chrome'],
    restartOnFileChange: true,
  });
};
