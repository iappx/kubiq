import type { TEfficiencyItem } from '@/domain/models/metrics/types/TEfficiencyItem'

export type TEfficiencyNamespaceGroup = {
    namespace: string
    items: TEfficiencyItem[]
    podCount: number
    maxCpuRatio: number
    maxMemoryRatio: number
    totalCpuUsedCores: number
    totalMemoryUsedBytes: number
}
