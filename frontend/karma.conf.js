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
// Medido con `npm run test:cov` sobre 108 tests:
//   71,57 sentencias · 47,13 ramas · 66,75 funciones · 73,64 líneas.
//
// Las ramas van muy por detrás del resto, y no es casualidad: cada `?? ''`,
// cada `| null` y cada estado que la interfaz no llega a pintar es una rama.
// Subirlas es el siguiente trabajo, no un número que se pueda inventar aquí.
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
          statements: 70,
          branches: 45,
          functions: 65,
          lines: 72,
        },
      },
    },

    reporters: ['progress', 'kjhtml'],
    browsers: ['Chrome'],
    restartOnFileChange: true,
  });
};
