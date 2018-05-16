const path = require('path')

module.exports = {
  rootDir: path.resolve(__dirname, '../'),
  moduleFileExtensions: [
    'js',
    'json'
  ],
  transform: {
    '^.+\\.js$': '<rootDir>/node_modules/babel-jest'
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  testPathIgnorePatterns: [
    '<rootDir>/build/',
    '<rootDir>/static/'
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    '**/*.{js}',
    '!**/test/**',
    '!**/coverage/**',
    '!.eslintrc.js'
  ],
  coverageReporters: ['html', 'text-summary'],
  snapshotSerializers: [
  ],
  testEnvironment: 'node'
}
