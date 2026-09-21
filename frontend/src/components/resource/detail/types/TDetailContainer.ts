import type { TUiTone } from '@/components/common/status/types/TUiTone'

export type TDetailContainer = {
    name: string
    image: string
    state: string
    restarts: number
    tone: TUiTone
    detail: string
}
