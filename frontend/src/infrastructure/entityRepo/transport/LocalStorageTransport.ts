import { singleton } from 'tsyringe'
import { ITransport } from '@iappx/entity-repo'
import { ApiError } from '@/domain/errors/ApiError'
import { TLocalStorageRequest } from '@/infrastructure/entityRepo/transport/types/TLocalStorageRequest'

@singleton()
export class LocalStorageTransport implements ITransport<TLocalStorageRequest> {
    public async send<TRes>(params: TLocalStorageRequest): Promise<TRes> {
        if (!this.isAvailable()) {
            return null as TRes
        }

        if (params.operation === 'read') {
            return localStorage.getItem(params.key) as TRes
        }

        return this.write(params) as TRes
    }

    private write(params: TLocalStorageRequest): null {
        try {
            localStorage.setItem(params.key, params.content ?? '')
        } catch (err) {
            // Quota and privacy modes reject the write, and from here on what the user
            // sees is not what is stored.
            throw new ApiError(
                'Could not save the changes',
                err instanceof Error ? err.message : String(err),
            )
        }
        return null
    }

    private isAvailable(): boolean {
        return typeof localStorage !== 'undefined'
    }
}
