// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export default tseslint.config(
  {
    ignores: ['dist/**', 'site/**', 'coverage/**', 'docs/**', 'examples/**', 'node_modules/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked.map((c) => ({
    ...c,
    files: ['src/**/*.ts', 'test/**/*.ts'],
  })),
  prettierConfig,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
      // Tightened to error in T24 once the v2 source rewrite removes the
      // axios-driven `any` leaks that forced these to be warnings.
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-enum-comparison': 'warn',
    },
  },
);
