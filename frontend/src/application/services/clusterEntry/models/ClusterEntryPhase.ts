import type { TClusterEntryPhase } from '@/application/services/clusterEntry/types/TClusterEntryPhase'
import type { TClusterEntryStatus } from '@/application/services/clusterEntry/types/TClusterEntryStatus'

export class ClusterEntryPhase {
    public static of(status: TClusterEntryStatus): TClusterEntryPhase {
        // A screen that mounts before the namespace scope is read lists every namespace on its way
        // to the one the operator chose, which on a large cluster is the whole cost of the page.
        if (status.connected) {
            return status.scoped ? 'ready' : 'connecting'
        }
        if (status.catalogFailure !== '') {
            return 'failed'
        }
        if (status.connecting || !status.catalogLoaded) {
            return 'connecting'
        }
        if (!status.known) {
            return 'unknown'
        }

        return status.failure === '' ? 'connecting' : 'failed'
    }
}
