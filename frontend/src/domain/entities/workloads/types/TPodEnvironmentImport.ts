import type { TPodEnvironmentObjectRef } from '@/domain/entities/workloads/types/TPodEnvironmentObjectRef'

export type TPodEnvironmentImport = {
    prefix: string
    object: TPodEnvironmentObjectRef
    optional: boolean
}
