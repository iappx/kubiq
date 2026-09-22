import type { TArgoHistoryRow } from '@/components/argocd/types/TArgoHistoryRow'
import type { TArgoApplicationSource } from '@/domain/entities/argocd/types/TArgoApplicationSource'
import type { TArgoRevisionHistory } from '@/domain/entities/argocd/types/TArgoRevisionHistory'
import { ArgoRevision } from '@/domain/models/argocd'

export class ArgoHistoryRowBuilder {
    public static build(history: readonly TArgoRevisionHistory[], currentRevision: string): TArgoHistoryRow[] {
        return [...history]
            .sort((left, right) => (right.id ?? 0) - (left.id ?? 0))
            .map(entry => ArgoHistoryRowBuilder.row(entry, currentRevision))
    }

    public static row(entry: TArgoRevisionHistory, currentRevision: string): TArgoHistoryRow {
        const revision = entry.revision ?? ''

        return {
            key: `${entry.id ?? 0}:${revision}`,
            id: entry.id ?? 0,
            revision,
            shortRevision: ArgoRevision.short(revision),
            deployedAt: entry.deployedAt ?? '',
            source: ArgoHistoryRowBuilder.sourceOf(entry.source),
            isCurrent: revision !== '' && revision === currentRevision,
        }
    }

    private static sourceOf(source: TArgoApplicationSource | undefined): string {
        if (!source) {
            return ''
        }

        return source.chart ? source.chart : (source.path ?? source.repoURL ?? '')
    }
}
