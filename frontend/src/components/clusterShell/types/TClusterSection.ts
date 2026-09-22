import type { TKubeSection } from '@/domain/models/kube'
import type { TClusterMenuItem } from '@/components/clusterShell/types/TClusterMenuItem'
import type { TClusterSubGroup } from '@/components/clusterShell/types/TClusterSubGroup'

export type TClusterSection = {
    key: TKubeSection
    title: string
    items: TClusterMenuItem[]
    groups: TClusterSubGroup[]
}
