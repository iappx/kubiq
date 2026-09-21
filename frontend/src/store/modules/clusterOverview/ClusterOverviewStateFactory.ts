import type { TClusterOverviewState } from '@/store/modules/clusterOverview/types/TClusterOverviewState'

export class ClusterOverviewStateFactory {
    public static empty(): TClusterOverviewState {
        return {
            overview: {
                workloads: [],
                nodes: { total: 0, ready: 0, issues: [], error: '' },
                events: [],
                eventsError: '',
            },
            loading: false,
            loaded: false,
            error: '',
            errorDetail: '',
        }
    }
}
