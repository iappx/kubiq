import type { TKubeSection } from '@/domain/models/kube'

export type TClusterMenuItem = {
    key: string
    title: string
    icon: string
    slug: string
    section: TKubeSection
    namespaced: boolean
}
