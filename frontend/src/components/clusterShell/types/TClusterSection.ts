import type { TKubeSection } from '@/domain/models/kube'
import type { TClusterMenuItem } from '@/components/clusterShell/types/TClusterMenuItem'

export type TClusterSection = {
    key: TKubeSection
    title: string
    items: TClusterMenuItem[]
}
