import type { TPortForwardRow } from '@/components/terminal/types/TPortForwardRow'

export type TPortForwardGroup = {
    clusterId: string
    title: string
    rows: TPortForwardRow[]
}
