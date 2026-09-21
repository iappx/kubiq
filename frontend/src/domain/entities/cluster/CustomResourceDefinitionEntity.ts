import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import { KubeConditions } from '@/domain/entities/kube/KubeConditions'
import { KubeObjectStateCatalog } from '@/domain/entities/kube/KubeObjectStateCatalog'
import type { TCustomResourceDefinitionSpec } from '@/domain/entities/cluster/types/TCustomResourceDefinitionSpec'
import type { TCustomResourceDefinitionStatus } from '@/domain/entities/cluster/types/TCustomResourceDefinitionStatus'
import type { TKubeCondition } from '@/domain/entities/kube/types/TKubeCondition'
import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'

export class CustomResourceDefinitionEntity extends RepoEntityBase<CustomResourceDefinitionEntity> {
    public static readonly establishedCondition: string = 'Established'

    public static readonly namesAcceptedCondition: string = 'NamesAccepted'

    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: TCustomResourceDefinitionSpec

    @RepoEntityField({ isReadonly: true })
    status: TCustomResourceDefinitionStatus

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get group(): string {
        return this.spec?.group ?? ''
    }

    get resource(): string {
        return this.spec?.names?.plural ?? ''
    }

    get definedKind(): string {
        return this.spec?.names?.kind ?? ''
    }

    get scope(): string {
        return this.spec?.scope ?? ''
    }

    get servedVersions(): string[] {
        return (this.spec?.versions ?? [])
            .filter(version => version.served === true && !!version.name)
            .map(version => version.name as string)
    }

    get servedVersionsText(): string {
        return this.servedVersions.join(', ')
    }

    get storedVersion(): string {
        return (this.spec?.versions ?? []).find(version => version.storage === true)?.name
            ?? this.status?.storedVersions?.[0]
            ?? ''
    }

    get conditions(): TKubeCondition[] {
        return this.status?.conditions ?? []
    }

    get isEstablished(): boolean {
        return KubeConditions.isTrue(this.conditions, CustomResourceDefinitionEntity.establishedCondition)
    }

    get state(): TKubeObjectState {
        if (this.metadata?.isDeleting) {
            return 'pending'
        }
        if (KubeConditions.find(this.conditions, CustomResourceDefinitionEntity.establishedCondition) === undefined) {
            return 'unknown'
        }
        if (KubeConditions.isFalse(this.conditions, CustomResourceDefinitionEntity.namesAcceptedCondition)) {
            return 'error'
        }
        return this.isEstablished ? 'ok' : 'pending'
    }

    get isProblematic(): boolean {
        return KubeObjectStateCatalog.isProblematic(this.state)
    }
}
