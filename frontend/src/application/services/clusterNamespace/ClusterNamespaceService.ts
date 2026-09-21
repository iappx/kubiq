import { inject, injectable } from 'tsyringe'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { NamespaceSelectionEntity } from '@/domain/entities/catalog/NamespaceSelectionEntity'
import { NamespaceFilters } from '@/domain/entities/cluster/NamespaceFilters'
import { EntityRepoProvider } from '@/infrastructure/entityRepo/EntityRepoProvider'

@injectable()
export class ClusterNamespaceService {
    constructor(
        @inject(EntityRepoProvider) private readonly repoProvider: EntityRepoProvider,
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
    ) {}

    public async listAvailable(clusterId: string): Promise<string[]> {
        const namespaces = await this.connectionService.context(clusterId).namespaces
            .where(f => NamespaceFilters.active(f))
            .getAll()

        return namespaces.map(namespace => namespace.name).filter(name => name.length > 0).sort()
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

    private static normalise(namespaces: readonly string[]): string[] {
        return [...new Set(namespaces.map(name => name.trim()).filter(name => name.length > 0))].sort()
    }
}
