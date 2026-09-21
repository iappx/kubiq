import { inject, injectable } from 'tsyringe'
import { KubeconfigService } from '@/application/services/kubeconfig/KubeconfigService'
import { KubeconfigSourceEntity } from '@/domain/entities/catalog/KubeconfigSourceEntity'
import { PinnedClusterEntity } from '@/domain/entities/catalog/PinnedClusterEntity'
import { ApiError } from '@/domain/errors/ApiError'
import { EntityRepoProvider } from '@/infrastructure/entityRepo/EntityRepoProvider'

@injectable()
export class ClusterCatalogService {
    constructor(
        @inject(EntityRepoProvider) private readonly repoProvider: EntityRepoProvider,
        @inject(KubeconfigService) private readonly kubeconfigService: KubeconfigService,
    ) {}

    public async getPinned(): Promise<string[]> {
        const pinned = await this.repoProvider.catalog.pinned.getAll()

        return pinned
            .sort((left, right) => left.pinnedAt - right.pinnedAt)
            .map(entity => entity.contextName)
    }

    public async pin(contextName: string, at: number): Promise<void> {
        if (await this.repoProvider.catalog.pinned.getById(contextName)) {
            return
        }

        await this.repoProvider.catalog.pinned.create(
            PinnedClusterEntity.build({ contextName, pinnedAt: at }),
        )
    }

    public unpin(contextName: string): Promise<void> {
        return this.repoProvider.catalog.pinned.remove(contextName)
    }

    public async getSources(): Promise<string[]> {
        const sources = await this.repoProvider.catalog.kubeconfigSources.getAll()

        return sources
            .sort((left, right) => left.addedAt - right.addedAt)
            .map(entity => entity.path)
    }

    public async addSource(path: string, at: number): Promise<string> {
        const trimmed = path.trim()
        if (!trimmed) {
            throw new ApiError('Enter the path to a kubeconfig file')
        }

        const [resolved] = await this.kubeconfigService.locate([trimmed])
        if (!resolved) {
            throw new ApiError(
                'That path could not be resolved',
                `Kubiq could not expand "${trimmed}" into a file path`,
            )
        }

        if (await this.repoProvider.catalog.kubeconfigSources.getById(resolved)) {
            throw new ApiError(`"${resolved}" is already in the catalog`)
        }

        const contexts = await this.kubeconfigService.getContexts([resolved])
        if (!contexts.some(context => context.filePath === resolved)) {
            throw new ApiError(
                'That file holds no kubeconfig contexts',
                `Read: ${resolved} — check the path, or open the file and confirm it lists contexts`,
            )
        }

        await this.repoProvider.catalog.kubeconfigSources.create(
            KubeconfigSourceEntity.build({ path: resolved, addedAt: at }),
        )

        return resolved
    }

    public removeSource(path: string): Promise<void> {
        return this.repoProvider.catalog.kubeconfigSources.remove(path)
    }
}
