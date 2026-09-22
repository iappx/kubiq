import type { TArgoApplicationRow } from '@/components/argocd/types/TArgoApplicationRow'
import type { TArgoHealthStatus } from '@/domain/entities/argocd/types/TArgoHealthStatus'
import type { TArgoSyncStatus } from '@/domain/entities/argocd/types/TArgoSyncStatus'

// Sync and health live in the object's status, which the API server cannot select on, so this
// is a filter over what was loaded — not a query written in the wrong place.
export class ArgoApplicationFilter {
    public static apply(
        rows: readonly TArgoApplicationRow[],
        text: string,
        sync: TArgoSyncStatus | '',
        health: TArgoHealthStatus | '',
    ): TArgoApplicationRow[] {
        return rows.filter(row => ArgoApplicationFilter.matches(row, text, sync, health))
    }

    public static matches(
        row: TArgoApplicationRow,
        text: string,
        sync: TArgoSyncStatus | '',
        health: TArgoHealthStatus | '',
    ): boolean {
        if (sync !== '' && row.syncStatus !== sync) {
            return false
        }
        if (health !== '' && row.healthStatus !== health) {
            return false
        }

        return ArgoApplicationFilter.matchesText(row, text)
    }

    private static matchesText(row: TArgoApplicationRow, text: string): boolean {
        const needle = text.trim().toLowerCase()
        if (needle === '') {
            return true
        }

        return `${row.name} ${row.project} ${row.destinationNamespace} ${row.sourceText}`
            .toLowerCase()
            .includes(needle)
    }

    public static countBySync(rows: readonly TArgoApplicationRow[], status: TArgoSyncStatus): number {
        return rows.reduce((count, row) => count + (row.syncStatus === status ? 1 : 0), 0)
    }

    public static countByHealth(rows: readonly TArgoApplicationRow[], status: TArgoHealthStatus): number {
        return rows.reduce((count, row) => count + (row.healthStatus === status ? 1 : 0), 0)
    }
}
