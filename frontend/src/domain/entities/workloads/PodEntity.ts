import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import { KubeObjectStateCatalog } from '@/domain/entities/kube/KubeObjectStateCatalog'
import { ContainerWaitingReasonCatalog } from '@/domain/entities/workloads/ContainerWaitingReasonCatalog'
import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'
import type { TKubeContainerStatus } from '@/domain/entities/workloads/types/TKubeContainerStatus'
import type { TPodPhase } from '@/domain/entities/workloads/types/TPodPhase'
import type { TPodSpec } from '@/domain/entities/workloads/types/TPodSpec'
import type { TPodStatus } from '@/domain/entities/workloads/types/TPodStatus'

export class PodEntity extends RepoEntityBase<PodEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: TPodSpec

    @RepoEntityField({ isReadonly: true })
    status: TPodStatus

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get namespace(): string {
        return this.metadata?.namespace ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get phase(): TPodPhase {
        return this.status?.phase ?? 'Unknown'
    }

    get nodeName(): string {
        return this.spec?.nodeName ?? ''
    }

    get podIp(): string {
        return this.status?.podIP ?? ''
    }

    get containerStatuses(): TKubeContainerStatus[] {
        return [...(this.status?.initContainerStatuses ?? []), ...(this.status?.containerStatuses ?? [])]
    }

    get containerCount(): number {
        return (this.spec?.containers ?? []).length
    }

    get readyContainerCount(): number {
        return (this.status?.containerStatuses ?? []).filter(p => p.ready === true).length
    }

    get readyText(): string {
        return `${this.readyContainerCount}/${this.containerCount}`
    }

    get restartCount(): number {
        return this.containerStatuses.reduce((total, status) => total + (status.restartCount ?? 0), 0)
    }

    get failingContainers(): TKubeContainerStatus[] {
        return this.containerStatuses.filter(p => PodEntity.isContainerFailing(p))
    }

    get reason(): string {
        const waiting = this.failingContainers[0]?.state?.waiting?.reason
        return waiting ?? this.status?.reason ?? ''
    }

    get state(): TKubeObjectState {
        if (this.metadata?.isDeleting) {
            return 'pending'
        }
        if (this.failingContainers.length > 0) {
            return 'error'
        }
        switch (this.phase) {
            case 'Failed':
                return 'error'
            case 'Succeeded':
                return 'ok'
            case 'Pending':
                return 'pending'
            case 'Running':
                return this.readyContainerCount === this.containerCount ? 'ok' : 'warning'
            default:
                return 'unknown'
        }
    }

    get isProblematic(): boolean {
        return KubeObjectStateCatalog.isProblematic(this.state)
    }

    protected static isContainerFailing(status: TKubeContainerStatus): boolean {
        const waitingReason = status.state?.waiting?.reason
        if (waitingReason !== undefined && ContainerWaitingReasonCatalog.isError(waitingReason)) {
            return true
        }
        const terminated = status.state?.terminated
        return terminated !== undefined && terminated.exitCode !== undefined && terminated.exitCode !== 0
    }
}
