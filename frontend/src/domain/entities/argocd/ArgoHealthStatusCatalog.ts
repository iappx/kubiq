import type { TArgoHealthStatus } from '@/domain/entities/argocd/types/TArgoHealthStatus'

export class ArgoHealthStatusCatalog {
    public static readonly unknown: TArgoHealthStatus = 'Unknown'

    private static readonly titles: Record<TArgoHealthStatus, string> = {
        Healthy: 'Healthy',
        Progressing: 'Progressing',
        Degraded: 'Degraded',
        Suspended: 'Suspended',
        Missing: 'Missing',
        Unknown: 'Unknown',
    }

    private static readonly sequence: TArgoHealthStatus[] = [
        'Healthy',
        'Progressing',
        'Degraded',
        'Suspended',
        'Missing',
        'Unknown',
    ]

    public static all(): TArgoHealthStatus[] {
        return [...ArgoHealthStatusCatalog.sequence]
    }

    public static has(status: string): boolean {
        return Object.prototype.hasOwnProperty.call(ArgoHealthStatusCatalog.titles, status)
    }

    public static title(status: TArgoHealthStatus): string {
        return ArgoHealthStatusCatalog.titles[status] ?? status
    }

    public static read(value: unknown): TArgoHealthStatus {
        return typeof value === 'string' && ArgoHealthStatusCatalog.has(value)
            ? value as TArgoHealthStatus
            : ArgoHealthStatusCatalog.unknown
    }
}
