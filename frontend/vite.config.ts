import { defineConfig, loadEnv } from 'vite'
import { readFileSync } from 'fs'
import * as path from 'path'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import Components from 'unplugin-vue-components/vite'
import MotionResolver from 'motion-v/resolver'
import RekaResolver from 'reka-ui/resolver'

// Tsyringe's ESM entry reads Reflect.getMetadata at module load, so reflect-metadata
// has to become a dependency of that entry — Rollup's chunk order decides otherwise.
const ensureReflectMetadataBeforeTsyringe = {
    name: 'ensure-reflect-metadata-before-tsyringe',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
        if (id.includes('tsyringe') && id.endsWith('index.js') && code.includes('Reflect.getMetadata')) {
            return { code: `import 'reflect-metadata';\n${code}`, map: null }
        }
        return null
    },
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    const { version } = JSON.parse(readFileSync(path.resolve(import.meta.dirname, 'package.json'), 'utf8'))

    return {
        define: {
            // .github/scripts/version.sh writes VERSION into package.json, so this is the release number.
            'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
        },
        plugins: [
            ensureReflectMetadataBeforeTsyringe,
            vue(),
            tailwindcss(),
            Components({
                dts: true,
                resolvers: [
                    MotionResolver(),
                    RekaResolver(),
                ],
            }),
        ],
        // Wails serves the bundle from the embedded FS, so every URL must be relative.
        base: '',
        server: {
            // Must match VITE_PORT in the root Taskfile.yml — `wails3 dev` points the
            // webview at that port.
            port: Number(env.VITE_DEV_PORT || 9245),
            strictPort: true,
            // Not `localhost`: where that resolves to ::1 first Vite binds IPv6 only,
            // and the Wails asset proxy dials 127.0.0.1 over tcp4 and gets refused.
            host: '127.0.0.1',
        },
        resolve: {
            alias: [
                {
                    find: '@',
                    replacement: path.resolve(import.meta.dirname, 'src'),
                },
                // monaco-worker-manager asks for the pre-0.50 path, and monaco-editor's
                // exports map rewrites it to esm/vs/esm/vs/... — the file is still there.
                {
                    find: 'monaco-editor/esm/vs/editor/editor.worker.js',
                    replacement: path.resolve(
                        import.meta.dirname,
                        'node_modules/monaco-editor/esm/vs/editor/editor.worker.js',
                    ),
                },
            ],
        },
        optimizeDeps: {
            include: ['reflect-metadata'],
        },
        // Monaco's language workers are ES modules that import each other, which the
        // default iife worker format cannot bundle.
        worker: {
            format: 'es',
        },
        build: {
            chunkSizeWarningLimit: 1024,
            cssCodeSplit: false,
            // main.go embeds `all:frontend/dist` — keep this in sync with it.
            outDir: './dist',
            assetsDir: 'assets',
            emptyOutDir: true,
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        if (id.includes('reflect-metadata') || id.includes('tsyringe')) {
                            return 'di-polyfills'
                        }
                    },
                },
            },
        },
    }
})
