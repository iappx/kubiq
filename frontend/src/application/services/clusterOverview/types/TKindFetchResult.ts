import type { RepoEntityBase } from '@iappx/entity-repo'
import type { TWorkloadSummary } from '@/application/services/clusterOverview/types/TWorkloadSummary'

export type TKindFetchResult = {
    registryKey: string
    summary: TWorkloadSummary
    items: RepoEntityBase[]
    error: string
}
