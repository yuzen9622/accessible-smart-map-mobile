// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'ios/*', 'android/*'],
  },
  {
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-expect-error': true, 'ts-nocheck': true },
      ],
    },
  },
  {
    // SDD §4.1 規則 2、3：domain 是純邏輯，要能在 node 下測。不得 import RN／Expo、其他 feature 的主出口
    // （會帶進 controller 與原生模組；請用 `@/features/<x>/domain`），也不得 import 有副作用的共用層。
    files: ['src/features/*/domain/**/*.ts'],
    ignores: ['src/features/*/domain/**/__tests__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react-native', 'react-native/*', 'expo', 'expo-*', '@expo/*'],
              message: 'domain 不得依賴 React Native／Expo（SDD §4.1 規則 2）。',
            },
            {
              // 除了 `@/features/<x>/domain`（含其子路徑）以外的 feature 路徑一律擋，包括深層的 controller／store。
              regex: '^@/features/[^/]+(?:$|/(?!domain(?:/|$)))',
              message: '跨 feature 的 domain 只能從 `@/features/<x>/domain` 引用（SDD §4.1 規則 3）。',
            },
            {
              group: ['../store', '../store/*', '../controller', '../controller/*', '../api', '../api/*', '../hooks', '../hooks/*', '../components', '../components/*', '../screens', '../screens/*'],
              message: 'domain 不得依賴自己 feature 的 store／controller／api／UI（SDD §4.1：依賴只往下）。',
            },
            {
              group: [
                '@/shared/api',
                '@/shared/api/*',
                '@/shared/config',
                '@/shared/config/*',
                '@/shared/i18n',
                '@/shared/i18n/*',
                '@/shared/location',
                '@/shared/location/*',
                '@/shared/polling',
                '@/shared/polling/*',
                '@/shared/storage',
                '@/shared/storage/*',
                '@/shared/theme',
                '@/shared/theme/*',
                '@/shared/ui',
                '@/shared/ui/*',
              ],
              message: 'domain 只能用純的共用層（例如 `@/shared/geo`）；有副作用的依賴請在 controller 注入。',
              // 型別 import 編譯後會被移除，不會把依賴帶進 domain。
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
]);
