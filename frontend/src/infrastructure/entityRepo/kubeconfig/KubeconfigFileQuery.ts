import { EntityQuery } from '@iappx/entity-repo'
import { KubeconfigFileEntity } from '@/domain/entities/kubeconfig/KubeconfigFileEntity'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import type { TFileEntry } from '@/infrastructure/entityRepo/transport/types/TFileEntry'
import type { TKubeconfigFileQueryOptions } from '@/infrastructure/entityRepo/kubeconfig/types/TKubeconfigFileQueryOptions'

export class KubeconfigFileQuery
    extends EntityQuery<KubeconfigFileEntity, FileSystemTransport, TKubeconfigFileQueryOptions> {

    public inFolder(path: string): KubeconfigFileQuery {
        return new KubeconfigFileQuery(this.entityConstructor, this.transport, { folder: path })
    }

    public async getAll(): Promise<KubeconfigFileEntity[]> {
        const folder = this.options?.folder
        if (!folder) {
            throw new Error('KubeconfigFileQuery needs a folder — ask the context for one with inFolder(path)')
        }

        const entries = await this.transport.send<TFileEntry[] | null>({ path: folder, operation: 'list' })

        return (entries ?? []).map(entry => KubeconfigFileQuery.build(entry))
    }

    public async getById(path: string): Promise<KubeconfigFileEntity | null> {
        const entry = await this.transport.send<TFileEntry | null>({ path, operation: 'stat' })

        return entry ? KubeconfigFileQuery.build(entry) : null
    }

    private static build(entry: TFileEntry): KubeconfigFileEntity {
        return KubeconfigFileEntity.build({
            path: entry.path,
            name: entry.name,
            isDirectory: entry.isDir,
            size: entry.size,
            modifiedAt: entry.modifiedAt,
        })
    }
}
