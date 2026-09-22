import type { TKubeconfigSourceMode } from '@/domain/entities/catalog/types/TKubeconfigSourceMode'

export type TKubeconfigSourceDraft = {
    mode: TKubeconfigSourceMode
    path: string
    text: string
}
