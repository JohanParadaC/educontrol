// backend/eslint.config.js
// ---------------------------------------------------------------------------
// Configuración plana de ESLint (formato nuevo, sin .eslintrc).
//
// El backend es CommonJS y corre en Node: nada de navegador, nada de módulos
// ES. Los tests añaden encima los globales de Jest.
// ---------------------------------------------------------------------------
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['coverage/**', 'node_modules/**'] },

  js.configs.recommended,

  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      // Variables sin usar: error. El prefijo _ marca lo que se ignora a
      // propósito, como el `_req` de un middleware que no mira la petición.
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          // `const { contraseña, ...resto } = obj` es omisión deliberada,
          // no una variable olvidada.
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },

  {
    files: ['__tests__/**/*.js', 'jest.setup.js', 'jest.config.js'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
  },
];
