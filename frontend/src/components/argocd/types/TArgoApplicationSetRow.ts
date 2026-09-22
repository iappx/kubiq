import type { TUiTone } from '@/components/common/status/types/TUiTone'

export type TArgoApplicationSetRow = {
    key: string
    name: string
    namespace: string
    project: string
    generators: string
    strategy: string
    tone: TUiTone
    statusText: string
    createdAt: string
}
