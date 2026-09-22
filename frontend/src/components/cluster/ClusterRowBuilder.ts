import type { TClusterConnection } from '@/application/services/cluster/types/TClusterConnection'
import type { TClusterContextInfo } from '@/application/services/cluster/types/TClusterContextInfo'
import { ClusterStatusCatalog } from '@/domain/entities/catalog/ClusterStatusCatalog'
import type { TClusterStatus } from '@/domain/entities/catalog/types/TClusterStatus'
import { ClusterHealthCatalog } from '@/domain/models/kube'
import type { TClusterHealth } from '@/domain/models/kube'
import { KubeconfigAuthTypeCatalog } from '@/domain/entities/kubeconfig/KubeconfigAuthTypeCatalog'
import type { TClusterRow } from '@/components/cluster/types/TClusterRow'
import type { TClusterRowInput } from '@/components/cluster/types/TClusterRowInput'

export class ClusterRowBuilder {
    public static build(input: TClusterRowInput): TClusterRow[] {
        const connections = new Map(input.connections.map(connection => [connection.clusterId, connection]))

        return input.contexts.map((context) => {
            const connection = connections.get(context.name)
            const status = ClusterRowBuilder.statusOf(context, connection, input)

            return {
                clusterId: context.name,
                name: context.name,
                status,
                statusTitle: ClusterStatusCatalog.title(status),
                clusterName: context.clusterName,
                server: context.server,
                namespace: context.namespace,
                authType: KubeconfigAuthTypeCatalog.title(context.authType),
                version: connection?.version ?? '',
                source: ClusterRowBuilder.fileName(context.filePath),
                filePath: context.filePath,
                sourceOrigin: input.sourceOrigins[context.filePath] ?? 'discovered',
                isPinned: input.pinned.includes(context.name),
                isCurrent: context.isCurrent,
                isActive: input.activeClusterId === context.name,
                isConnected: connection !== undefined,
                canOpenChannel: connection?.canOpenChannel ?? false,
                detail: ClusterRowBuilder.detailOf(context, connection, status, input),
            }
        })
    }

    public static filter(rows: readonly TClusterRow[], text: string): TClusterRow[] {
        const needle = text.trim().toLowerCase()
        if (needle === '') {
            return [...rows]
        }

        return rows.filter(row => ClusterRowBuilder.haystack(row).includes(needle))
    }

    public static pinnedOf(rows: readonly TClusterRow[], pinned: readonly string[]): TClusterRow[] {
        const order = new Map(pinned.map((name, index) => [name, index]))

        return rows
            .filter(row => order.has(row.clusterId))
            .sort((left, right) => (order.get(left.clusterId) ?? 0) - (order.get(right.clusterId) ?? 0))
    }

    private static statusOf(
        context: TClusterContextInfo,
        connection: TClusterConnection | undefined,
        input: TClusterRowInput,
    ): TClusterStatus {
        if (input.connectingIds.includes(context.name)) {
            return 'connecting'
        }
        if (connection) {
            return ClusterRowBuilder.ofHealth(ClusterRowBuilder.healthOf(context.name, input))
        }
        if (!context.isSupported) {
            return 'unsupported'
        }

        return input.failures[context.name] ? 'unreachable' : 'available'
    }

    private static ofHealth(health: TClusterHealth): TClusterStatus {
        if (health === 'expired') {
            return 'expired'
        }

        return health === 'unreachable' ? 'unreachable' : 'connected'
    }

    private static healthOf(clusterId: string, input: TClusterRowInput): TClusterHealth {
        return input.health?.[clusterId] ?? 'healthy'
    }

    private static detailOf(
        context: TClusterContextInfo,
        connection: TClusterConnection | undefined,
        status: TClusterStatus,
        input: TClusterRowInput,
    ): string {
        if (status === 'unsupported') {
            return context.unsupportedReason
        }
        if (status === 'expired' || (status === 'unreachable' && connection)) {
            return ClusterHealthCatalog.notice(ClusterRowBuilder.healthOf(context.name, input)).description
        }
        if (status === 'unreachable') {
            return input.failures[context.name] ?? ''
        }
        if (status === 'connected' && connection && !connection.canOpenChannel) {
            return connection.channelBlockReason
        }

        return ''
    }

    private static haystack(row: TClusterRow): string {
        return [row.name, row.clusterName, row.server, row.namespace, row.source]
            .join(' ')
            .toLowerCase()
    }

    private static fileName(path: string): string {
        const separator = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
        return separator < 0 ? path : path.slice(separator + 1)
    }
}
