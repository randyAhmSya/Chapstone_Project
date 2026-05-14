'use strict'

export default {
  testEnvironment: 'node',
  clearMocks:      true,
  restoreMocks:    true,
  testTimeout:     15000,

  roots:     ['<rootDir>/tests'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],

  // Alias @src → <rootDir>/src sehingga semua test bisa pakai require('@src/utils/constants')
  // tanpa peduli kedalaman folder test-nya
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },

  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/config/prisma.js',
    '!src/config/supabase.js',
  ],
  coverageThreshold: {
    global: {
      lines:     80,
      functions: 80,
      branches:  75,
    },
  },
}