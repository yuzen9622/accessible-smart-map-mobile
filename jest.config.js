/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/src'],
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/'],
};
