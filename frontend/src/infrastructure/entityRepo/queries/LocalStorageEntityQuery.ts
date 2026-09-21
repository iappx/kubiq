import { RepoEntityBase } from '@iappx/entity-repo'
import { LocalStorageTransport } from '@/infrastructure/entityRepo/transport/LocalStorageTransport'
import { JsonCollectionQueryBase } from '@/infrastructure/entityRepo/queries/base/JsonCollectionQueryBase'
import { TLocalStorageQueryOptions } from '@/infrastructure/entityRepo/queries/types/TLocalStorageQueryOptions'

export class LocalStorageEntityQuery<T extends RepoEntityBase>
    extends JsonCollectionQueryBase<T, LocalStorageTransport, TLocalStorageQueryOptions> {

    protected read(): Promise<string | null> {
        return this.transport.send<string | null>({ key: this.key, operation: 'read' })
    }

    protected async write(content: string): Promise<void> {
        await this.transport.send<null>({ key: this.key, operation: 'write', content })
    }

    private get key(): string {
        const key = this.options?.key
        if (!key) {
            throw new Error('LocalStorageEntityQuery needs a key — set it in the @RepoEntitySet options')
        }
        return key
    }
}
