import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Run tests from the tests/ directory
        include: ['tests/**/*.test.js'],
        // Use Node environment by default (detection modules are pure logic)
        environment: 'node',
        // ES modules — no transformation needed
        globals: true,
    },
    resolve: {
        // Allow importing .js extensions (ES module convention)
        extensions: ['.js', '.json'],
    },
});
