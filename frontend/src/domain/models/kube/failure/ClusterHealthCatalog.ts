import { KubeFailureCatalog } from '@/domain/models/kube/failure/KubeFailureCatalog'
import type { TClusterHealth } from '@/domain/models/kube/failure/types/TClusterHealth'
import type { TClusterHealthNotice } from '@/domain/models/kube/failure/types/TClusterHealthNotice'
import type { TKubeFailureKind } from '@/domain/models/kube/failure/types/TKubeFailureKind'

export class ClusterHealthCatalog {
    private static readonly notices: Record<TClusterHealth, TClusterHealthNotice> = {
        healthy: {
            title: 'Connected',
            description: 'The cluster is answering.',
        },
        degraded: {
            title: 'Cluster unstable',
            description: 'The last requests to this cluster did not get through. kubiq keeps trying.',
        },
        expired: {
            title: 'Credentials expired',
            description: 'The cluster rejected the credentials. Reconnect it from the catalog to sign in again.',
        },
        unreachable: {
            title: 'Cluster unreachable',
            description: 'kubiq cannot reach the API server. Check the network, the VPN and the cluster address.',
        },
    }

    private static readonly offline: TClusterHealthNotice = {
        title: 'No network',
        description: 'This machine is offline. Live data resumes on its own once the network is back.',
    }

    public static notice(health: TClusterHealth): TClusterHealthNotice {
        return ClusterHealthCatalog.notices[health] ?? ClusterHealthCatalog.notices.degraded
    }

    public static offlineNotice(): TClusterHealthNotice {
        return ClusterHealthCatalog.offline
    }

    public static ofFailure(kind: TKubeFailureKind): TClusterHealth {
        if (kind === 'unauthorized') {
            return 'expired'
        }
        if (kind === 'unreachable' || kind === 'tls' || kind === 'disconnected') {
            return 'unreachable'
        }

        return KubeFailureCatalog.isTransient(kind) ? 'degraded' : 'healthy'
    }

    public static needsReconnect(health: TClusterHealth): boolean {
        return health === 'expired'
    }

    public static isHealthy(health: TClusterHealth): boolean {
        return health === 'healthy'
    }
}
