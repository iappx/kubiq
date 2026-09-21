import { injectable } from 'tsyringe'

@injectable()
export class WailsRuntimeService {
    public isAvailable(): boolean {
        if (typeof window === 'undefined') {
            return false
        }

        // Not `window._wails`: since alpha2 the runtime package creates that object on
        // import, in a plain browser too, so only a native bridge proves a host webview.
        const host = window as unknown as Record<string, any>

        return !!(
            host.chrome?.webview?.postMessage
            || host.webkit?.messageHandlers?.external?.postMessage
            || host.wails?.invoke
        )
    }
}
