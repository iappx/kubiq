import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import type { TKubeObjectRef } from '@/domain/entities/kube/types/TKubeObjectRef'
import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'
import type { TEventSource } from '@/domain/entities/cluster/types/TEventSource'
import type { TEventType } from '@/domain/entities/cluster/types/TEventType'

// An Event carries its payload at the top level of the object rather than in
// spec/status, so the entity mirrors that shape instead of the usual one.
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

    /** RFC 3339 timestamp. */
    @RepoEntityField()
    firstTimestamp: string

    /** RFC 3339 timestamp. */
    @RepoEntityField()
    lastTimestamp: string

    /** RFC 3339 timestamp; the only one set by the events.k8s.io reporter. */
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
