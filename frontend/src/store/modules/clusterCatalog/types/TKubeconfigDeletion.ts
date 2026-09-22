import type { TClusterSourceOrigin } from '@/domain/entities/catalog/types/TClusterSourceOrigin'

export type TKubeconfigDeletion = {
    filePath: string
    origin: TClusterSourceOrigin
    clusterNames: string[]
}
