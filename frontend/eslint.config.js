// frontend/eslint.config.js
// ---------------------------------------------------------------------------
// Configuración plana de ESLint para Angular 20.
//
// Dos bloques: uno para TypeScript y otro para las plantillas HTML (incluidas
// las inline, gracias a `processInlineTemplates`).
//
// Sobre `no-explicit-any`: hoy quedan usos heredados repartidos por data/ y
// features/. Está como aviso, no como error, con un tope de avisos en el
// script `lint` para que el número solo pueda bajar: cualquier `any` nuevo
// rompe la build. Cuando la limpieza del contrato los elimine, el tope baja
// a cero y la regla pasa a error.
// ---------------------------------------------------------------------------
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', '.angular/**'] },

  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      // 27 componentes siguen inyectando por constructor. Migrarlos a inject()
      // es trabajo de la fase "Angular al día"; hasta entonces cuenta como
      // aviso y entra en el tope, no como error que bloquea.
      '@angular-eslint/prefer-inject': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  {
    files: ['**/*.html'],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {},
  }
);
