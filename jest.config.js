/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/'],
  // `shared/ui/Icon` 逐一 deep import Lucide 圖示（避免 barrel 把全部圖示打進 bundle）；那個路徑只解析到
  // ESM `.mjs`，Jest 的 babel transform 不處理 .mjs，改指到同一套件的 CJS 版本。
  moduleNameMapper: {
    '^lucide-react-native/icons/(.*)$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/icons/$1.js',
  },
};
