import type { TArgoApplicationDestination } from '@/domain/entities/argocd/types/TArgoApplicationDestination'

export type TArgoAppProjectSpec = {
    description?: string
    sourceRepos?: string[]
    destinations?: TArgoApplicationDestination[]
    sourceNamespaces?: string[]
}
