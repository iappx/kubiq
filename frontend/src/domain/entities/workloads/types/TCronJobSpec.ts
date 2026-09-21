import type { TCronJobConcurrencyPolicy } from '@/domain/entities/workloads/types/TCronJobConcurrencyPolicy'
import type { TKubeJobTemplate } from '@/domain/entities/workloads/types/TKubeJobTemplate'

export type TCronJobSpec = {
    schedule?: string
    jobTemplate?: TKubeJobTemplate
    timeZone?: string
    suspend?: boolean
    concurrencyPolicy?: TCronJobConcurrencyPolicy
    startingDeadlineSeconds?: number
    successfulJobsHistoryLimit?: number
    failedJobsHistoryLimit?: number
}
