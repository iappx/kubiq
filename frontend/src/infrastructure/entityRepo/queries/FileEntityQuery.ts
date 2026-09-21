import { RepoEntityBase } from '@iappx/entity-repo'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { JsonCollectionQueryBase } from '@/infrastructure/entityRepo/queries/base/JsonCollectionQueryBase'
import { TFileQueryOptions } from '@/infrastructure/entityRepo/queries/types/TFileQueryOptions'

export class FileEntityQuery<T extends RepoEntityBase>
    extends JsonCollectionQueryBase<T, FileSystemTransport, TFileQueryOptions> {

    protected read(): Promise<string | null> {
        return this.transport.send<string | null>({ path: this.file, operation: 'read' })
    }

    protected async write(content: string): Promise<void> {
        await this.transport.send<null>({ path: this.file, operation: 'write', content })
    }

    private get file(): string {
        const file = this.options?.file
        if (!file) {
            throw new Error('FileEntityQuery needs a file — set it in the @RepoEntitySet options')
        }
        return file
    }
}
