import type { TKubeQuantityMap } from '@/domain/entities/config/types/TKubeQuantityMap'

export type TResourceQuotaStatus = {
    hard?: TKubeQuantityMap
    used?: TKubeQuantityMap
}
