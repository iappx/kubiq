import type { TArgoSyncDraft } from '@/domain/entities/argocd/types/TArgoSyncDraft'

export class ArgoSyncDraftDefaults {
    public static blank(): TArgoSyncDraft {
        return {
            revision: '',
            prune: false,
            dryRun: false,
            force: false,
            replace: false,
            applyOutOfSyncOnly: false,
        }
    }

    public static atRevision(revision: string): TArgoSyncDraft {
        return { ...ArgoSyncDraftDefaults.blank(), revision }
    }
}
