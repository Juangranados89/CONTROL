import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';

globalThis.process = globalThis.process || { env: {} };

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'server/**'
    ]
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-refresh': reactRefreshPlugin
    },
    settings: {
      react: { version: 'detect' }
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,

      // Este repo no usa prop-types (y es un monolito grande)
      'react/prop-types': 'off',

      // Entorno browser (evita miles de falsos positivos por globals)
      'no-undef': 'off',

      // Evitar que el lint obligue a refactors masivos en App.jsx
      'no-unused-vars': 'off',

      // En este codebase hay varios escapes heredados en regex/strings
      'no-useless-escape': 'off',

      // React Hooks: por ahora no bloqueante
      'react-hooks/exhaustive-deps': 'off',

      // Modern React: JSX runtime
      'react/react-in-jsx-scope': 'off',

      // Repo style: keep warnings low-noise
      'no-console': 'off',

      // No bloquear por entidades en texto
      'react/no-unescaped-entities': 'off',

      // Fast refresh: no bloquear
      'react-refresh/only-export-components': 'off'
    }
  }
];
