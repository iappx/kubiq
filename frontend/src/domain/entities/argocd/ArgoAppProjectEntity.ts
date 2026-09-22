import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import type { TArgoApplicationDestination } from '@/domain/entities/argocd/types/TArgoApplicationDestination'
import type { TArgoAppProjectSpec } from '@/domain/entities/argocd/types/TArgoAppProjectSpec'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'

export class ArgoAppProjectEntity extends RepoEntityBase<ArgoAppProjectEntity> {
    public static readonly anySource: string = '*'

    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: TArgoAppProjectSpec

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get namespace(): string {
        return this.metadata?.namespace ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get description(): string {
        return this.spec?.description ?? ''
    }

    get sourceRepos(): string[] {
        return this.spec?.sourceRepos ?? []
    }

    get destinations(): TArgoApplicationDestination[] {
        return this.spec?.destinations ?? []
    }

    get sourceReposText(): string {
        const repos = this.sourceRepos

        return repos.includes(ArgoAppProjectEntity.anySource) ? 'Any' : repos.join(', ')
    }

    get destinationsText(): string {
        return this.destinations
            .map(destination => ArgoAppProjectEntity.describe(destination))
            .join(', ')
    }

    private static describe(destination: TArgoApplicationDestination): string {
        const cluster = destination.name ?? destination.server ?? ArgoAppProjectEntity.anySource

        return `${cluster}/${destination.namespace ?? ArgoAppProjectEntity.anySource}`
    }
}
