import type { TArgoResourceRow } from '@/components/argocd/types/TArgoResourceRow'

export type TArgoResourceGroup = {
    title: string
    description: string
    rows: TArgoResourceRow[]
}
