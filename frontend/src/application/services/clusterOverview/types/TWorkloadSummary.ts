import type { TKubeSection } from '@/domain/models/kube'

export type TWorkloadSummary = {
    kindKey: string
    title: string
    icon: string
    slug: string
    section: TKubeSection
    total: number
    healthy?: number
    problems: number
    warnings?: number
    errors?: number
    note?: string
    error: string
}
