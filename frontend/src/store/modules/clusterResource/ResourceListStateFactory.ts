import type { TResourceListState } from '@/store/modules/clusterResource/types/TResourceListState'

export class ResourceListStateFactory {
    public static empty(): TResourceListState {
        return {
            items: [],
            total: undefined,
            loading: false,
            loaded: false,
            error: '',
            errorDetail: '',
            forbidden: false,
            busyKeys: [],
            cursors: [],
            watching: false,
            staleSince: 0,
            flashKeys: [],
        }
    }
}
