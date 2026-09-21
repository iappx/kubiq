import type { TNodePodsState } from '@/store/modules/node/types/TNodePodsState'

export class NodePodsStateFactory {
    public static empty(): TNodePodsState {
        return {
            loading: false,
            loaded: false,
            error: '',
            errorDetail: '',
            forbidden: false,
            pods: [],
        }
    }
}
