import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
    collectCoverageFrom: ['packages/**/*.{ts,tsx}'],
    coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
    setupFilesAfterEnv: [],
    moduleNameMapper: {
        '^@crystaldb/core$': '<rootDir>/packages/core/src/index.ts',
        '^@crystaldb/core/(.*)$': '<rootDir>/packages/core/src/$1',
        '^@crystaldb/node$': '<rootDir>/packages/node/src/index.ts',
        '^@crystaldb/node/(.*)$': '<rootDir>/packages/node/src/$1',
        '^@crystaldb/react$': '<rootDir>/packages/react/src/index.ts',
        '^@crystaldb/react/(.*)$': '<rootDir>/packages/react/src/$1'
    },
    transform: {
        '^.+\\.(ts|tsx)$': [
            'ts-jest',
            {
                tsconfig: '<rootDir>/tsconfig.json'
            }
        ]
    }
};

export default config;

