import type { THelmReleaseStatus } from '@/domain/entities/helm/types/THelmReleaseStatus'

export class HelmReleaseStatusCatalog {
    public static readonly values: Record<THelmReleaseStatus, string> = {
        'unknown': 'Unknown',
        'deployed': 'Deployed',
        'uninstalled': 'Uninstalled',
        'superseded': 'Superseded',
        'failed': 'Failed',
        'uninstalling': 'Uninstalling',
        'pending-install': 'Pending install',
        'pending-upgrade': 'Pending upgrade',
        'pending-rollback': 'Pending rollback',
    }

    public static readonly Default: THelmReleaseStatus = 'unknown'

    public static title(status: THelmReleaseStatus): string {
        return HelmReleaseStatusCatalog.values[status] ?? status
    }

    public static has(status: string): boolean {
        return Object.prototype.hasOwnProperty.call(HelmReleaseStatusCatalog.values, status)
    }

    public static parse(status: unknown): THelmReleaseStatus {
        if (typeof status !== 'string') {
            return HelmReleaseStatusCatalog.Default
        }

        const normalised = status.trim().toLowerCase()

        return HelmReleaseStatusCatalog.has(normalised)
            ? normalised as THelmReleaseStatus
            : HelmReleaseStatusCatalog.Default
    }

    public static isPending(status: THelmReleaseStatus): boolean {
        return status.startsWith('pending-') || status === 'uninstalling'
    }

    public static isLive(status: THelmReleaseStatus): boolean {
        return status !== 'uninstalled' && status !== 'superseded'
    }
}
