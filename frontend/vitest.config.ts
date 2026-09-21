import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import * as path from 'path'

export default defineConfig({
    plugins: [vue()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./test/setup.ts'],
        include: ['test/**/*.spec.ts'],
    },
    resolve: {
        alias: { '@': path.resolve(import.meta.dirname, './src') },
    },
    // Vite 8 transforms with oxc, not esbuild — an `esbuild` block here would be
    // silently ignored.
    oxc: {
        // The codebase is decorator-driven (tsyringe, @InjectableStore, @Entity).
        // Class fields must not be defined via Object.defineProperty, or the
        // property initialisers wipe values the decorators set on the prototype;
        // `setPublicClassFields` is oxc's spelling of useDefineForClassFields: false.
        target: 'es2020',
        decorator: { legacy: true },
        assumptions: { setPublicClassFields: true },
    },
})
