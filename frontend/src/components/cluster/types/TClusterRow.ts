import type { TClusterStatus } from '@/domain/entities/catalog/types/TClusterStatus'

export type TClusterRow = {
    clusterId: string
    name: string
    status: TClusterStatus
    statusTitle: string
    clusterName: string
    server: string
    namespace: string
    authType: string
    version: string
    source: string
    filePath: string
    isPinned: boolean
    isCurrent: boolean
    isActive: boolean
    isConnected: boolean
    canOpenChannel: boolean
    detail: string
}
