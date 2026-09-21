import type { TQueryMeta } from '@iappx/entity-repo-query'
import type { THelmReleaseRef } from '@/domain/entities/helm/types/THelmReleaseRef'

export class HelmQueryMeta {
    public static readonly releaseKey: string = 'helmRelease'

    public static readonly supersededKey: string = 'helmSuperseded'

    public static readonly allVersionsKey: string = 'helmAllVersions'

    public static forRelease(ref: THelmReleaseRef): TQueryMeta {
        return { [HelmQueryMeta.releaseKey]: { ...ref } }
    }

    public static releaseOf(meta?: TQueryMeta): THelmReleaseRef | undefined {
        const value = meta ? meta[HelmQueryMeta.releaseKey] : undefined
        if (!value || typeof value !== 'object') {
            return undefined
        }

        const ref = value as Partial<THelmReleaseRef>

        return typeof ref.name === 'string' ? { name: ref.name, namespace: ref.namespace ?? '' } : undefined
    }

    public static withSuperseded(): TQueryMeta {
        return { [HelmQueryMeta.supersededKey]: true }
    }

    public static includesSuperseded(meta?: TQueryMeta): boolean {
        return meta?.[HelmQueryMeta.supersededKey] === true
    }

    public static withAllVersions(): TQueryMeta {
        return { [HelmQueryMeta.allVersionsKey]: true }
    }

    public static includesAllVersions(meta?: TQueryMeta): boolean {
        return meta?.[HelmQueryMeta.allVersionsKey] === true
    }
}
