import type { TUiTone } from '@/components/common/status/types/TUiTone'

export type TPortForwardRow = {
    id: string
    clusterId: string
    target: string
    address: string
    path: string
    tone: TUiTone
    statusTitle: string
    modeTitle: string
    modeHint: string
    error: string
    isListening: boolean
    canOpen: boolean
    canCopy: boolean
    canStop: boolean
}
