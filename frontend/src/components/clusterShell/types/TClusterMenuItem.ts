import type { TKubeSection } from '@/domain/models/kube'

export type TClusterMenuItem = {
    key: string
    title: string
    icon: string
    slug: string
    group: string
    section: TKubeSection
    order?: number
    namespaced: boolean
}
