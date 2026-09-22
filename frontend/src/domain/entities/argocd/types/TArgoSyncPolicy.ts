import type { TArgoAutomatedSyncPolicy } from '@/domain/entities/argocd/types/TArgoAutomatedSyncPolicy'

export type TArgoSyncPolicy = {
    // Turning automation off is a merge patch that erases the key, so null is a value we send.
    automated?: TArgoAutomatedSyncPolicy | null
    syncOptions?: string[]
}
