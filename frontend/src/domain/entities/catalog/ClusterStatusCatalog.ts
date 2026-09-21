import type { TClusterStatus } from '@/domain/entities/catalog/types/TClusterStatus'

export class ClusterStatusCatalog {
    public static readonly values: Record<TClusterStatus, string> = {
        connected: 'Connected',
        connecting: 'Connecting',
        available: 'Available',
        unreachable: 'Unreachable',
        unsupported: 'Unsupported',
    }

    public static title(status: TClusterStatus): string {
        return ClusterStatusCatalog.values[status] ?? status
    }

    public static has(status: string): boolean {
        return Object.prototype.hasOwnProperty.call(ClusterStatusCatalog.values, status)
    }

    public static isConnectable(status: TClusterStatus): boolean {
        return status === 'available' || status === 'unreachable'
    }

    public static isProblematic(status: TClusterStatus): boolean {
        return status === 'unreachable' || status === 'unsupported'
    }
}
