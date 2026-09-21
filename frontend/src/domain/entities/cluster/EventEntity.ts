import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import type { TKubeObjectRef } from '@/domain/entities/kube/types/TKubeObjectRef'
import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'
import type { TEventSource } from '@/domain/entities/cluster/types/TEventSource'
import type { TEventType } from '@/domain/entities/cluster/types/TEventType'

// An Event carries its payload at the top level of the object, not in spec/status.
export class EventEntity extends RepoEntityBase<EventEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    type: TEventType

    @RepoEntityField()
    reason: string

    @RepoEntityField()
    message: string

    @RepoEntityField()
    count: number

    @RepoEntityField()
    involvedObject: TKubeObjectRef

    @RepoEntityField()
    source: TEventSource

    @RepoEntityField()
    firstTimestamp: string

    @RepoEntityField()
    lastTimestamp: string

    // The only timestamp the events.k8s.io reporter sets, hence the fallback in `lastSeen`.
    @RepoEntityField()
    eventTime: string

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get namespace(): string {
        return this.metadata?.namespace ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get lastSeen(): string {
        return this.lastTimestamp || this.eventTime || this.firstTimestamp || this.createdAt
    }

    get involvedObjectText(): string {
        const ref = this.involvedObject
        if (!ref?.kind || !ref?.name) {
            return ''
        }
        return `${ref.kind}: ${ref.name}`
    }

    get isWarning(): boolean {
        return this.type === 'Warning'
    }

    get state(): TKubeObjectState {
        return this.isWarning ? 'warning' : 'ok'
    }

    get isProblematic(): boolean {
        return this.isWarning
    }
}
