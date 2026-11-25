import parser from '@babel/eslint-parser';
import globals from 'globals';
import hooks from 'eslint-plugin-react-hooks';
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/android/**',
      '**/ios/**',
      '**/.expo/**',
      'backend/generated/**',
    ],
  },
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      parser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: { parserOpts: { plugins: ['jsx'] } },
      },
      globals: { ...globals.browser, ...globals.node, __DEV__: 'readonly' },
    },
    plugins: { 'react-hooks': hooks },
    rules: {
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
