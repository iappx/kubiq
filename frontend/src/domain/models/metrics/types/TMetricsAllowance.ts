import type { TUsageAllowance } from '@/domain/models/metrics/types/TUsageAllowance'

export type TMetricsAllowance = {
    cpu: TUsageAllowance
    memory: TUsageAllowance
}
