import type { TArgoApplicationSpec } from '@/domain/entities/argocd/types/TArgoApplicationSpec'

export type TArgoApplicationSetSpec = {
    generators?: Record<string, unknown>[]
    goTemplate?: boolean
    strategy?: { type?: string }
    template?: { spec?: TArgoApplicationSpec }
}
