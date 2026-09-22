import type { TPodEnvironmentSourceKind } from '@/domain/entities/workloads/types/TPodEnvironmentSourceKind'

export type TPodEnvironmentObjectRef = {
    sourceKind: TPodEnvironmentSourceKind
    name: string
}
