import type { TKubeObjectRef } from '@/domain/entities/kube/types/TKubeObjectRef'

export type TCronJobStatus = {
    active?: TKubeObjectRef[]
    lastScheduleTime?: string
    lastSuccessfulTime?: string
}
