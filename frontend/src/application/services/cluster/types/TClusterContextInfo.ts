import type { TKubeconfigAuthType } from '@/domain/entities/kubeconfig/types/TKubeconfigAuthType'

export type TClusterContextInfo = {
    name: string
    filePath: string
    clusterName: string
    server: string
    namespace: string
    authType: TKubeconfigAuthType
    isCurrent: boolean
    isSupported: boolean
    unsupportedReason: string
}
