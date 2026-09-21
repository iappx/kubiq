import type { TKubeObjectRef } from '@/domain/entities/kube/types/TKubeObjectRef'

export type TCronJobStatus = {
    active?: TKubeObjectRef[]
    /** RFC 3339 timestamp. */
    lastScheduleTime?: string
    /** RFC 3339 timestamp. */
    lastSuccessfulTime?: string
}
