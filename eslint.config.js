// @ts-check
import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import tseslint from 'typescript-eslint'
import antfu from 'eslint-plugin-antfu'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.vue-directives-tsc/**',
      '**/node_modules/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  stylistic.configs.customize({
    pluginName: 'style',
    indent: 2,
    quotes: 'single',
    semi: false,
    jsx: true,
    arrowParens: true,
    braceStyle: '1tbs',
    commaDangle: 'always-multiline',
  }),
  {
    plugins: { antfu },
    rules: {
      'antfu/consistent-list-newline': 'error',
      'style/jsx-one-expression-per-line': 'off',
      'style/object-curly-newline': [
        'error',
        {
          ImportDeclaration: { minProperties: 2 },
          ExportDeclaration: { minProperties: 2 },
        },
      ],
      'style/operator-linebreak': [
        'error',
        'after',
        { overrides: { '|': 'before', '&': 'before', '?': 'before', ':': 'before' } },
      ],
      'style/quote-props': ['error', 'as-needed'],
    },
  },
  {
    files: ['playground/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
)
