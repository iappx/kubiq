import { ArgoSyncOptions } from '@/domain/models/argocd/ArgoSyncOptions'
import type { TArgoApplicationSource } from '@/domain/entities/argocd/types/TArgoApplicationSource'
import type { TArgoOperation } from '@/domain/entities/argocd/types/TArgoOperation'
import type { TArgoSyncDraft } from '@/domain/entities/argocd/types/TArgoSyncDraft'

// Writing `operation` is how a sync is asked for over the Kubernetes API: the application
// controller picks the field up and clears it once it is done.
export class ArgoOperationBuilder {
    public static readonly initiator: string = 'kubiq'

    public static sync(draft: TArgoSyncDraft, source?: TArgoApplicationSource): TArgoOperation {
        const options = ArgoSyncOptions.of(draft)
        const revision = draft.revision.trim()

        return {
            initiatedBy: { username: ArgoOperationBuilder.initiator, automated: false },
            sync: {
                prune: draft.prune,
                dryRun: draft.dryRun,
                ...(revision === '' ? {} : { revision }),
                ...(options.length === 0 ? {} : { syncOptions: options }),
                ...(source === undefined ? {} : { source }),
            },
        }
    }
}
