import type { TArgoSyncDraft } from '@/domain/entities/argocd/types/TArgoSyncDraft'

// The controller reads these as opaque strings on operation.sync.syncOptions; the spelling is Argo CD's.
export class ArgoSyncOptions {
    public static readonly force: string = 'Force=true'

    public static readonly replace: string = 'Replace=true'

    public static readonly applyOutOfSyncOnly: string = 'ApplyOutOfSyncOnly=true'

    public static of(draft: TArgoSyncDraft): string[] {
        return [
            draft.force ? ArgoSyncOptions.force : '',
            draft.replace ? ArgoSyncOptions.replace : '',
            draft.applyOutOfSyncOnly ? ArgoSyncOptions.applyOutOfSyncOnly : '',
        ].filter(option => option !== '')
    }
}
