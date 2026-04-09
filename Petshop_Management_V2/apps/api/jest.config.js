/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@petshop/auth$': '<rootDir>/../../packages/auth/src/index.ts',
    '^@petshop/config$': '<rootDir>/../../packages/config/src/index.ts',
    '^@petshop/core$': '<rootDir>/../../packages/core/src/index.ts',
    '^@petshop/database$': '<rootDir>/../../packages/database/src/index.ts',
    '^@petshop/queue$': '<rootDir>/../../packages/queue/src/index.ts',
    '^@petshop/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  clearMocks: true,
}
