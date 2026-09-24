// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: ['dist/*', '.expo/*', '.claude/*', 'src/db/migrations/*'],
  },
  {
    rules: {
      'import/no-cycle': 'warn',
    },
  },
  {
    // Logs go through src/lib/log.ts, which keeps personal data out of production logs.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/log.ts', 'src/**/*.test.{ts,tsx}'],
    rules: {
      'no-console': 'error',
    },
  },
]);
