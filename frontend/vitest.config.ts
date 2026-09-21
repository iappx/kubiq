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
    // Vite 8 transforms with oxc, not esbuild — an `esbuild` block here is silently ignored.
    oxc: {
        // `setPublicClassFields` is oxc's spelling of useDefineForClassFields: false —
        // with defineProperty semantics, field initialisers wipe what decorators set.
        target: 'es2020',
        decorator: { legacy: true },
        assumptions: { setPublicClassFields: true },
    },
})
