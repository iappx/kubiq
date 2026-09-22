import type { TPodEnvironmentKeyRef } from '@/domain/entities/workloads/types/TPodEnvironmentKeyRef'
import type { TPodEnvironmentOrigin } from '@/domain/entities/workloads/types/TPodEnvironmentOrigin'

export type TPodEnvironmentVariable = {
    name: string
    origin: TPodEnvironmentOrigin
    value: string
    container: string
    reference: TPodEnvironmentKeyRef | null
}
