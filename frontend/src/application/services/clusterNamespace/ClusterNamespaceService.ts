import { inject, injectable } from 'tsyringe'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import type { TNamespaceCatalog } from '@/application/services/clusterNamespace/types/TNamespaceCatalog'
import { ResourceWatchService } from '@/application/services/resourceWatch/ResourceWatchService'
import type { TResourceWatchHandlers } from '@/application/services/resourceWatch/types/TResourceWatchHandlers'
import { NamespaceSelectionEntity } from '@/domain/entities/catalog/NamespaceSelectionEntity'
import { NamespaceFilters } from '@/domain/entities/cluster/NamespaceFilters'
import { KubeResourceRegistry } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'
import { EntityRepoProvider } from '@/infrastructure/entityRepo/EntityRepoProvider'

@injectable()
export class ClusterNamespaceService {
    // A scope of its own, so the picker and the namespaces screen watch the same kind side by side.
    private static readonly watchScope: string = 'catalog'

    constructor(
        @inject(EntityRepoProvider) private readonly repoProvider: EntityRepoProvider,
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
        @inject(ResourceWatchService) private readonly watchService: ResourceWatchService,
    ) {}

    public async list(clusterId: string): Promise<TNamespaceCatalog> {
        const page = await this.connectionService.context(clusterId).namespaces
            .where(f => NamespaceFilters.active(f))
            .getPage()

        return {
            names: page.items.map(namespace => namespace.name).filter(name => name.length > 0).sort(),
            resourceVersion: page.cursor?.start ?? '',
        }
    }

    public async watch(clusterId: string, resourceVersion: string, handlers: TResourceWatchHandlers): Promise<void> {
        const kind = ClusterNamespaceService.namespaceKind()
        if (!kind?.canWatch || resourceVersion === '') {
            return
        }

        await this.watchService.start({
            clusterId,
            kind,
            cursors: [{ namespace: '', resourceVersion }],
            scope: ClusterNamespaceService.watchScope,
        }, handlers)
    }

    public async unwatch(clusterId: string): Promise<void> {
        const kind = ClusterNamespaceService.namespaceKind()
        if (kind) {
            await this.watchService.stop(clusterId, kind, ClusterNamespaceService.watchScope)
        }
    }

    public async getSelection(clusterId: string): Promise<string[]> {
        const stored = await this.repoProvider.catalog.namespaceSelections.getById(clusterId)

        return stored?.namespaces ?? []
    }

    public async getSelections(): Promise<Record<string, string[]>> {
        const stored = await this.repoProvider.catalog.namespaceSelections.getAll()
        const selections: Record<string, string[]> = {}

        stored.forEach((entity) => {
            selections[entity.contextName] = entity.namespaces ?? []
        })

        return selections
    }

    public async setSelection(clusterId: string, namespaces: readonly string[]): Promise<string[]> {
        const chosen = ClusterNamespaceService.normalise(namespaces)
        const stored = await this.repoProvider.catalog.namespaceSelections.getById(clusterId)

        if (chosen.length === 0) {
            if (stored) {
                await this.repoProvider.catalog.namespaceSelections.remove(clusterId)
            }
            return chosen
        }

        const entity = NamespaceSelectionEntity.build({ contextName: clusterId, namespaces: chosen })
        if (stored) {
            await this.repoProvider.catalog.namespaceSelections.update(entity)
        } else {
            await this.repoProvider.catalog.namespaceSelections.create(entity)
        }

        return chosen
    }

    public clearSelection(clusterId: string): Promise<void> {
        return this.repoProvider.catalog.namespaceSelections.remove(clusterId)
    }

    private static namespaceKind(): KubeResourceKind | undefined {
        return KubeResourceRegistry.find('', 'namespaces')
    }

    private static normalise(namespaces: readonly string[]): string[] {
        return [...new Set(namespaces.map(name => name.trim()).filter(name => name.length > 0))].sort()
    }
}
