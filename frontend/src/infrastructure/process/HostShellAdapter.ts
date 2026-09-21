import { inject, singleton } from 'tsyringe'
import { IoService } from '../../../bindings/iappx_k8s_admin/core/services/io'
import { ApiError } from '@/domain/errors/ApiError'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

@singleton()
export class HostShellAdapter {
    public static readonly unopenable: string = 'Could not open that address'

    constructor(
        @inject(WailsRuntimeService) private readonly runtime: WailsRuntimeService,
    ) {}

    public get isAvailable(): boolean {
        return this.runtime.isAvailable()
    }

    public async exists(path: string): Promise<boolean> {
        if (path === '' || !this.isAvailable) {
            return false
        }

        try {
            const result = await IoService.FileExists(path)
            return result.success && result.data === 'true'
        } catch {
            return false
        }
    }

    public async absolutePath(path: string): Promise<string> {
        if (!this.isAvailable) {
            return ''
        }

        try {
            const result = await IoService.AbsolutePath(path)
            return result.success ? result.data : ''
        } catch {
            return ''
        }
    }

    public async openUri(uri: string): Promise<void> {
        if (!this.isAvailable) {
            return
        }

        let result
        try {
            result = await IoService.OpenURI(uri)
        } catch (err) {
            throw new ApiError(HostShellAdapter.unopenable, err instanceof Error ? err.message : String(err))
        }

        if (!result.success) {
            throw new ApiError(HostShellAdapter.unopenable, result.data)
        }
    }
}
