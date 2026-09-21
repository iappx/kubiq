import type { TKubeQuantityMap } from '@/domain/entities/config/types/TKubeQuantityMap'

export type TLimitRangeItem = {
    type?: string
    max?: TKubeQuantityMap
    min?: TKubeQuantityMap
    default?: TKubeQuantityMap
    defaultRequest?: TKubeQuantityMap
    maxLimitRequestRatio?: TKubeQuantityMap
}
