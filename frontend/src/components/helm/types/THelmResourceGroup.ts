import type { THelmResourceLink } from '@/components/helm/types/THelmResourceLink'

export type THelmResourceGroup = {
    title: string
    description: string
    icon: string
    links: THelmResourceLink[]
}
