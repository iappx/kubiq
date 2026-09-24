import type { TKubeconfigProblem } from '@/application/services/kubeconfig/types/TKubeconfigProblem'
import type { KubeconfigContextEntity } from '@/domain/entities/kubeconfig/KubeconfigContextEntity'

export type TKubeconfigRead = {
    files: string[]
    contexts: KubeconfigContextEntity[]
    currentContextName: string
    problems: TKubeconfigProblem[]
}
