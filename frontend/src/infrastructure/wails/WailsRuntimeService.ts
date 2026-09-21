import { injectable } from 'tsyringe'

@injectable()
// In a plain browser (vitest, a bare vite run) the bindings are absent and every
// call would reject — anything touching them asks here first.
export class WailsRuntimeService {
    public isAvailable(): boolean {
        if (typeof window === 'undefined') {
            return false
        }

        // A native bridge is the only proof of a host webview, and this mirrors
        // how @wailsio/runtime itself decides. `window._wails` proves nothing:
        // since alpha2 the runtime package creates that object on import, in a
        // browser too, and the transports stopped degrading quietly.
        const host = window as unknown as Record<string, any>

        return !!(
            host.chrome?.webview?.postMessage
            || host.webkit?.messageHandlers?.external?.postMessage
            || host.wails?.invoke
        )
    }
}
