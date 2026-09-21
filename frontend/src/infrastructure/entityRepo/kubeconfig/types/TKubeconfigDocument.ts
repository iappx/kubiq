import type { TKubeconfigClusterDocument } from '@/infrastructure/entityRepo/kubeconfig/types/TKubeconfigClusterDocument'
import type { TKubeconfigContextDocument } from '@/infrastructure/entityRepo/kubeconfig/types/TKubeconfigContextDocument'
import type { TKubeconfigUserDocument } from '@/infrastructure/entityRepo/kubeconfig/types/TKubeconfigUserDocument'

export type TKubeconfigDocument = {
    apiVersion?: string
    kind?: string
    'current-context'?: string
    preferences?: Record<string, unknown>
    clusters?: { name?: string; cluster?: TKubeconfigClusterDocument }[]
    contexts?: { name?: string; context?: TKubeconfigContextDocument }[]
    users?: { name?: string; user?: TKubeconfigUserDocument }[]
}
