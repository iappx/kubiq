import type { CronJobEntity } from '@/domain/entities/workloads'
import type { KubeResourceKind } from '@/domain/models/kube'

export type TCronJobTriggerRequest = {
    clusterId: string
    cronJob: CronJobEntity
    jobKind: KubeResourceKind
}
