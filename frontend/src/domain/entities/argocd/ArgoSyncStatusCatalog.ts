import type { TArgoSyncStatus } from '@/domain/entities/argocd/types/TArgoSyncStatus'

export class ArgoSyncStatusCatalog {
    public static readonly unknown: TArgoSyncStatus = 'Unknown'

    private static readonly titles: Record<TArgoSyncStatus, string> = {
        Synced: 'Synced',
        OutOfSync: 'Out of sync',
        Unknown: 'Unknown',
    }

    private static readonly sequence: TArgoSyncStatus[] = ['Synced', 'OutOfSync', 'Unknown']

    public static all(): TArgoSyncStatus[] {
        return [...ArgoSyncStatusCatalog.sequence]
    }

    public static has(status: string): boolean {
        return Object.prototype.hasOwnProperty.call(ArgoSyncStatusCatalog.titles, status)
    }

    public static title(status: TArgoSyncStatus): string {
        return ArgoSyncStatusCatalog.titles[status] ?? status
    }

    public static read(value: unknown): TArgoSyncStatus {
        return typeof value === 'string' && ArgoSyncStatusCatalog.has(value)
            ? value as TArgoSyncStatus
            : ArgoSyncStatusCatalog.unknown
    }
}
