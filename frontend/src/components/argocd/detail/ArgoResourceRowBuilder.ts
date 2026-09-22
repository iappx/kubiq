import { ArgoToneMap } from '@/components/argocd/ArgoToneMap'
import type { TArgoResourceRow } from '@/components/argocd/types/TArgoResourceRow'
import { ArgoHealthStatusCatalog } from '@/domain/entities/argocd/ArgoHealthStatusCatalog'
import { ArgoSyncStatusCatalog } from '@/domain/entities/argocd/ArgoSyncStatusCatalog'
import type { TArgoResourceStatus } from '@/domain/entities/argocd/types/TArgoResourceStatus'
import type { TUiTone } from '@/components/common/status/types/TUiTone'

export class ArgoResourceRowBuilder {
    public static build(resources: readonly TArgoResourceStatus[]): TArgoResourceRow[] {
        return resources.map(resource => ArgoResourceRowBuilder.row(resource))
    }

    public static row(resource: TArgoResourceStatus): TArgoResourceRow {
        const sync = ArgoSyncStatusCatalog.read(resource.status)
        const health = resource.health?.status

        return {
            key: ArgoResourceRowBuilder.keyOf(resource),
            kind: resource.kind ?? '',
            apiVersion: ArgoResourceRowBuilder.apiVersionOf(resource),
            name: resource.name ?? '',
            namespace: resource.namespace ?? '',
            syncText: ArgoSyncStatusCatalog.title(sync),
            healthText: health ? ArgoHealthStatusCatalog.title(ArgoHealthStatusCatalog.read(health)) : '',
            healthMessage: resource.health?.message ?? '',
            tone: ArgoResourceRowBuilder.toneOf(resource),
            requiresPruning: resource.requiresPruning === true,
        }
    }

    public static apiVersionOf(resource: TArgoResourceStatus): string {
        const group = resource.group ?? ''
        const version = resource.version ?? ''

        return group === '' ? version : `${group}/${version}`
    }

    // A resource Argo CD has no health for — a ConfigMap, say — is judged on its sync state alone.
    private static toneOf(resource: TArgoResourceStatus): TUiTone {
        const health = resource.health?.status

        return health
            ? ArgoToneMap.ofHealth(ArgoHealthStatusCatalog.read(health))
            : ArgoToneMap.ofSync(ArgoSyncStatusCatalog.read(resource.status))
    }

    private static keyOf(resource: TArgoResourceStatus): string {
        return [
            ArgoResourceRowBuilder.apiVersionOf(resource),
            resource.kind ?? '',
            resource.namespace ?? '',
            resource.name ?? '',
        ].join('/')
    }
}
