import { defineConfig, loadEnv } from 'vite'
import * as path from 'path'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import Components from 'unplugin-vue-components/vite'
import MotionResolver from 'motion-v/resolver'
import RekaResolver from 'reka-ui/resolver'

// Tsyringe's ESM entry checks Reflect.getMetadata at module load time (top-level).
// This plugin makes reflect-metadata an explicit dependency of tsyringe's entry,
// guaranteeing it runs first regardless of Rollup's chunk ordering.
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

    return {
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
        // Wails serves the built assets from the embedded FS, so every URL in the
        // bundle must be relative — never switch this to an absolute base.
        base: '',
        server: {
            // Must match VITE_PORT in the root Taskfile.yml: `wails3 dev` starts
            // this server and points the webview at that port.
            port: Number(env.VITE_DEV_PORT || 9245),
            strictPort: true,
            // Spelled out instead of the default `localhost`: on a host where
            // localhost resolves to ::1 first, Vite would bind IPv6 only, while
            // the Wails asset proxy dials 127.0.0.1 over tcp4 and gets refused.
            host: '127.0.0.1',
        },
        resolve: {
            alias: [
                {
                    find: '@',
                    replacement: path.resolve(import.meta.dirname, 'src'),
                },
            ],
        },
        optimizeDeps: {
            include: ['reflect-metadata'],
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
