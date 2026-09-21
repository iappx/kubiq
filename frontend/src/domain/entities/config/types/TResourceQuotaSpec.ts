import type { TKubeQuantityMap } from '@/domain/entities/config/types/TKubeQuantityMap'

export type TResourceQuotaSpec = {
    hard?: TKubeQuantityMap
    scopes?: string[]
}
