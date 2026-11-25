import type { TClusterRow } from '@/components/cluster/types/TClusterRow'

export type TClusterSwitchGroup = {
    key: 'connected' | 'disconnected'
    title: string
    rows: TClusterRow[]
}
