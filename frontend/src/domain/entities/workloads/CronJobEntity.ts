import { RepoEntityBase, RepoEntityField } from '@iappx/entity-repo'
import { ObjectMetaEntity } from '@/domain/entities/kube/ObjectMetaEntity'
import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'
import type { TCronJobSpec } from '@/domain/entities/workloads/types/TCronJobSpec'
import type { TCronJobStatus } from '@/domain/entities/workloads/types/TCronJobStatus'

export class CronJobEntity extends RepoEntityBase<CronJobEntity> {
    @RepoEntityField({ isPrimaryKey: true, isClientOnly: true })
    uid: string

    @RepoEntityField()
    apiVersion: string

    @RepoEntityField()
    kind: string

    @RepoEntityField({ nestedType: () => ObjectMetaEntity })
    metadata: ObjectMetaEntity

    @RepoEntityField()
    spec: TCronJobSpec

    @RepoEntityField({ isReadonly: true })
    status: TCronJobStatus

    get name(): string {
        return this.metadata?.name ?? ''
    }

    get namespace(): string {
        return this.metadata?.namespace ?? ''
    }

    get createdAt(): string {
        return this.metadata?.creationTimestamp ?? ''
    }

    get schedule(): string {
        return this.spec?.schedule ?? ''
    }

    get jobTemplateSpec(): Record<string, unknown> {
        return this.spec?.jobTemplate?.spec ?? {}
    }

    get jobTemplateLabels(): Record<string, string> {
        return this.spec?.jobTemplate?.metadata?.labels ?? {}
    }

    get jobTemplateAnnotations(): Record<string, string> {
        return this.spec?.jobTemplate?.metadata?.annotations ?? {}
    }

    get isSuspended(): boolean {
        return this.spec?.suspend === true
    }

    get activeCount(): number {
        return (this.status?.active ?? []).length
    }

    get lastScheduleTime(): string {
        return this.status?.lastScheduleTime ?? ''
    }

    // Suspension is an operator's decision, not a fault, so it reads as waiting rather than as something to flag.
    get state(): TKubeObjectState {
        if (this.metadata?.isDeleting) {
            return 'pending'
        }
        return this.isSuspended ? 'pending' : 'ok'
    }

    get isProblematic(): boolean {
        return false
    }
}
