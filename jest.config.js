// See: https://jestjs.io/docs/configuration

/** @type {import('jest').Config} */
const jestConfig = {
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: ['./src/**'],
  coverageDirectory: './coverage',
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
  coverageReporters: ['json-summary', 'text', 'lcov'],
  // TypeScript via swc: it has no dependency on the `typescript` package, so it
  // works regardless of the TS compiler version.
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      { jsc: { target: 'es2024', parser: { syntax: 'typescript' } } }
    ]
  },
  extensionsToTreatAsEsm: ['.ts'],
  // Sources import `./x.js` (nodenext style); resolve those to the `.ts` files.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  moduleFileExtensions: ['ts', 'js'],
  reporters: ['default'],
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  testPathIgnorePatterns: ['/dist/', '/node_modules/'],
  verbose: true
}

export default jestConfig
