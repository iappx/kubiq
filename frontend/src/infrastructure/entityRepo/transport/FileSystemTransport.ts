import { inject, singleton } from 'tsyringe'
import { ITransport } from '@iappx/entity-repo'
import { IoService } from '../../../../bindings/iappx_k8s_admin/core/services/io'
import { IOOptions } from '../../../../bindings/iappx_k8s_admin/core/services/io/models'
import { ApiError } from '@/domain/errors/ApiError'
import { TFileRequest } from '@/infrastructure/entityRepo/transport/types/TFileRequest'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

@singleton()
export class FileSystemTransport implements ITransport<TFileRequest> {
    private static readonly TEXT_OPTIONS = new IOOptions({ Mode: 'Text', Range: '' })

    constructor(
        @inject(WailsRuntimeService) private readonly runtime: WailsRuntimeService,
    ) {}

    public async send<TRes>(params: TFileRequest): Promise<TRes> {
        if (!this.runtime.isAvailable()) {
            return null as TRes
        }

        if (params.operation === 'read') {
            return await this.read(params) as TRes
        }

        if (params.operation === 'remove') {
            return await this.remove(params) as TRes
        }

        return await this.write(params) as TRes
    }

    private async read(params: TFileRequest): Promise<string | null> {
        const result = await this.call(
            () => IoService.ReadFile(params.path, FileSystemTransport.TEXT_OPTIONS),
            'Could not load the data',
        )

        // A missing file is the normal first-run state, not an error.
        if (!result.success || !result.data) {
            return null
        }

        return result.data
    }

    private async write(params: TFileRequest): Promise<null> {
        const message = 'Could not save the changes'

        const result = await this.call(
            () => IoService.WriteFile(params.path, params.content ?? '', FileSystemTransport.TEXT_OPTIONS),
            message,
        )

        if (!result.success) {
            throw new ApiError(message, result.data)
        }

        return null
    }

    private async remove(params: TFileRequest): Promise<null> {
        const message = 'Could not delete the file'

        const result = await this.call(() => IoService.RemoveFile(params.path), message)

        if (!result.success) {
            throw new ApiError(message, result.data)
        }

        return null
    }

    private async call<T>(action: () => Promise<T>, message: string): Promise<T> {
        try {
            return await action()
        } catch (err) {
            throw new ApiError(message, err instanceof Error ? err.message : String(err))
        }
    }
}
