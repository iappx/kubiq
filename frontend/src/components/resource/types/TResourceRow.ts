import type { TUiTone } from '@/components/common/status/types/TUiTone'

export type TResourceRow = {
    key: string
    name: string
    namespace: string
    createdAt: string
    tone: TUiTone
    statusTitle: string
    [column: string]: unknown
}
