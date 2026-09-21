import type { TNodeTaint } from '@/domain/entities/cluster/types/TNodeTaint'

export type TNodeSpec = {
    podCIDR?: string
    podCIDRs?: string[]
    providerID?: string
    unschedulable?: boolean
    taints?: TNodeTaint[]
}
