import { inject, singleton } from 'tsyringe'
import { IoService } from '../../../bindings/iappx_k8s_admin/core/services/io'
import { StorageService } from '../../../bindings/iappx_k8s_admin/core/services/storage'
import { ApiError } from '@/domain/errors/ApiError'
import type { TStorageInfo } from '@/domain/models/settings'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

@singleton()
export class AppStorageAdapter {
    public static readonly LogFolder = 'userdata:logs'

    constructor(
        @inject(WailsRuntimeService) private readonly runtime: WailsRuntimeService,
    ) {}

    public async info(): Promise<TStorageInfo> {
        if (!this.runtime.isAvailable()) {
            return AppStorageAdapter.unknown()
        }

        try {
            const result = await StorageService.Info()

            return result.success
                ? { root: result.root, logs: result.logs, version: result.version }
                : AppStorageAdapter.unknown()
        } catch {
            return AppStorageAdapter.unknown()
        }
    }

    public async openLogFolder(): Promise<void> {
        if (!this.runtime.isAvailable()) {
            return
        }

        const message = 'Could not open the log folder'

        let result
        try {
            result = await IoService.OpenDir(AppStorageAdapter.LogFolder)
        } catch (err) {
            throw new ApiError(message, err instanceof Error ? err.message : String(err))
        }

        if (!result.success) {
            throw new ApiError(message, result.data)
        }
    }

    private static unknown(): TStorageInfo {
        return { root: '', logs: '', version: 0 }
    }
}
