// frontend/eslint.config.js
// ---------------------------------------------------------------------------
// Configuración plana de ESLint para Angular 20.
//
// Dos bloques: uno para TypeScript y otro para las plantillas HTML (incluidas
// las inline, gracias a `processInlineTemplates`).
//
// Sobre `no-explicit-any` y `prefer-inject`: los dos eran avisos con un tope de
// 58 en el script `lint`, y un tope sin explicación solo sabe subir. Ya no
// queda ninguno de los dos, así que van como ERROR y el script lleva
// `--max-warnings=0`: la deuda no se tolera en masa, se arregla o se silencia
// una a una con el motivo escrito al lado.
//
// En los `*.spec.ts` `no-explicit-any` está apagada (bloque de abajo). Un doble
// de test tipado a medias es ruido, no deuda: contarlo hinchaba el número y
// escondía los `any` de producción, que son los que importan.
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
      '@typescript-eslint/no-explicit-any': 'error',
      '@angular-eslint/prefer-inject': 'error',
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
    // Los dobles de test no describen el contrato de nadie: se montan a mano
    // para provocar una situación y se tiran. Exigirles tipos completos no
    // añade seguridad, solo ruido en el recuento.
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {},
  }
);
