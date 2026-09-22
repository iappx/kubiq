import { ArgoApplicationFilter } from '@/components/argocd/ArgoApplicationFilter'
import { ArgoToneMap } from '@/components/argocd/ArgoToneMap'
import type { TArgoApplicationRow } from '@/components/argocd/types/TArgoApplicationRow'
import type { TArgoStatusOption } from '@/components/argocd/types/TArgoStatusOption'
import { ArgoHealthStatusCatalog } from '@/domain/entities/argocd/ArgoHealthStatusCatalog'
import { ArgoSyncStatusCatalog } from '@/domain/entities/argocd/ArgoSyncStatusCatalog'

export class ArgoStatusOptions {
    public static sync(rows: readonly TArgoApplicationRow[]): TArgoStatusOption[] {
        return ArgoSyncStatusCatalog.all().map(status => ({
            key: status,
            label: ArgoSyncStatusCatalog.title(status),
            count: ArgoApplicationFilter.countBySync(rows, status),
            tone: ArgoToneMap.ofSync(status),
        }))
    }

    public static health(rows: readonly TArgoApplicationRow[]): TArgoStatusOption[] {
        return ArgoHealthStatusCatalog.all().map(status => ({
            key: status,
            label: ArgoHealthStatusCatalog.title(status),
            count: ArgoApplicationFilter.countByHealth(rows, status),
            tone: ArgoToneMap.ofHealth(status),
        }))
    }
}
