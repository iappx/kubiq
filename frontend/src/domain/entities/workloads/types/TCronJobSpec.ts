import type { TCronJobConcurrencyPolicy } from '@/domain/entities/workloads/types/TCronJobConcurrencyPolicy'

export type TCronJobSpec = {
    schedule?: string
    timeZone?: string
    suspend?: boolean
    concurrencyPolicy?: TCronJobConcurrencyPolicy
    startingDeadlineSeconds?: number
    successfulJobsHistoryLimit?: number
    failedJobsHistoryLimit?: number
}
