import type { TUiTone } from '@/components/common/status/types/TUiTone'

export type TArgoResourceRow = {
    key: string
    kind: string
    apiVersion: string
    name: string
    namespace: string
    syncText: string
    healthText: string
    healthMessage: string
    tone: TUiTone
    requiresPruning: boolean
}
