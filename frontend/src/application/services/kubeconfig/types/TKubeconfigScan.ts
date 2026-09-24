import type { TKubeconfigProblem } from '@/application/services/kubeconfig/types/TKubeconfigProblem'

export type TKubeconfigScan = {
    files: string[]
    problems: TKubeconfigProblem[]
}
