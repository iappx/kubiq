import type { TClusterContextInfo } from '@/application/services/cluster/types/TClusterContextInfo'
import type { TKubeconfigProblem } from '@/application/services/kubeconfig/types/TKubeconfigProblem'

export type TClusterCatalogRead = {
    contexts: TClusterContextInfo[]
    problems: TKubeconfigProblem[]
}
