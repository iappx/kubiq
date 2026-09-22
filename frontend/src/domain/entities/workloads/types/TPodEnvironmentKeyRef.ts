import type { TPodEnvironmentObjectRef } from '@/domain/entities/workloads/types/TPodEnvironmentObjectRef'

export type TPodEnvironmentKeyRef = {
    object: TPodEnvironmentObjectRef
    key: string
    optional: boolean
}
