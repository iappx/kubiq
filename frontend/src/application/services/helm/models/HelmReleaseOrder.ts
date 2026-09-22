import type { HelmReleaseEntity } from '@/domain/entities/helm/HelmReleaseEntity'

export class HelmReleaseOrder {
    public static merge(batches: readonly HelmReleaseEntity[][], limit: number): HelmReleaseEntity[] {
        return HelmReleaseOrder.byUpdated(batches.flat()).slice(0, limit)
    }

    public static byUpdated(releases: readonly HelmReleaseEntity[]): HelmReleaseEntity[] {
        return [...releases].sort((left, right) => HelmReleaseOrder.compare(left, right))
    }

    private static compare(left: HelmReleaseEntity, right: HelmReleaseEntity): number {
        const gap = HelmReleaseOrder.instantOf(right.updated) - HelmReleaseOrder.instantOf(left.updated)

        return gap === 0 ? left.id.localeCompare(right.id) : gap
    }

    private static instantOf(updated: string): number {
        const parsed = Date.parse(HelmReleaseOrder.iso(updated))

        return Number.isNaN(parsed) ? 0 : parsed
    }

    // helm prints Go's "2006-01-02 15:04:05.999999999 -0700 MST", which Date.parse rejects
    // as soon as the machine's zone abbreviation is one it does not recognise.
    private static iso(updated: string): string {
        return updated
            .replace(' ', 'T')
            .replace(/\.(\d{3})\d+/, '.$1')
            .replace(/\s+([+-]\d{4})(\s+\S+)?$/, '$1')
    }
}
