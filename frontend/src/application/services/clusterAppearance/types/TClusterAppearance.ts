import type { TClusterIcon } from '@/domain/entities/catalog/types/TClusterIcon'

export type TClusterAppearance = {
    clusterId: string
    displayName: string
    icon: TClusterIcon
    imagePath: string
}
