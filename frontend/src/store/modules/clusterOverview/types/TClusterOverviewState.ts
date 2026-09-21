import type { TClusterOverview } from '@/application/services/clusterOverview/types/TClusterOverview'

export type TClusterOverviewState = {
    overview: TClusterOverview
    loading: boolean
    loaded: boolean
    error: string
    errorDetail: string
}
