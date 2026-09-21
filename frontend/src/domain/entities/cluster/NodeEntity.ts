import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import { KubeConditions } from '@/domain/entities/kube/KubeConditions'
import { KubeObjectStateCatalog } from '@/domain/entities/kube/KubeObjectStateCatalog'
import { NodeConditionCatalog } from '@/domain/entities/cluster/NodeConditionCatalog'
import { NodeFilters } from '@/domain/entities/cluster/NodeFilters'
import type { TKubeCondition } from '@/domain/entities/kube/types/TKubeCondition'
import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'
import type { TNodeSpec } from '@/domain/entities/cluster/types/TNodeSpec'
import type { TNodeStatus } from '@/domain/entities/cluster/types/TNodeStatus'

export class NodeEntity extends RepoEntityBase<NodeEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: TNodeSpec

    @RepoEntityField({ isReadonly: true })
    status: TNodeStatus

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get conditions(): TKubeCondition[] {
        return this.status?.conditions ?? []
    }

    get isReady(): boolean {
        return KubeConditions.isTrue(this.conditions, NodeConditionCatalog.ready)
    }

    get isCordoned(): boolean {
        return this.spec?.unschedulable === true
    }

    get pressures(): string[] {
        return NodeConditionCatalog.pressureTypes().filter(p => KubeConditions.isTrue(this.conditions, p))
    }

    get roles(): string[] {
        const labels = this.metadata?.labels ?? {}
        return Object.keys(labels)
            .filter(key => key.startsWith(NodeFilters.rolePrefix))
            .map(key => key.slice(NodeFilters.rolePrefix.length))
            .filter(role => role.length > 0)
    }

    get internalIp(): string {
        return (this.status?.addresses ?? []).find(p => p.type === 'InternalIP')?.address ?? ''
    }

    get kubeletVersion(): string {
        return this.status?.nodeInfo?.kubeletVersion ?? ''
    }

    get osImage(): string {
        return this.status?.nodeInfo?.osImage ?? ''
    }

    get containerRuntime(): string {
        return this.status?.nodeInfo?.containerRuntimeVersion ?? ''
    }

    get architecture(): string {
        return this.status?.nodeInfo?.architecture ?? ''
    }

    get taintCount(): number {
        return (this.spec?.taints ?? []).length
    }

    get state(): TKubeObjectState {
        if (this.metadata?.isDeleting) {
            return 'pending'
        }
        if (KubeConditions.find(this.conditions, NodeConditionCatalog.ready) === undefined) {
            return 'unknown'
        }
        if (!this.isReady) {
            return 'error'
        }
        return this.isCordoned || this.pressures.length > 0 ? 'warning' : 'ok'
    }

    get isProblematic(): boolean {
        return KubeObjectStateCatalog.isProblematic(this.state)
    }
}
