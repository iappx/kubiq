import type { TKubeconfigSourceMode } from '@/domain/entities/catalog/types/TKubeconfigSourceMode'

export type TKubeconfigSource = {
    path: string
    origin: TKubeconfigSourceMode
}
