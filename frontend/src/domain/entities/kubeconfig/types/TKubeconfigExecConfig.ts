import type { TKubeconfigExecEnvVar } from '@/domain/entities/kubeconfig/types/TKubeconfigExecEnvVar'

export type TKubeconfigExecConfig = {
    apiVersion: string
    command: string
    args: string[]
    env: TKubeconfigExecEnvVar[]
    installHint: string
    interactiveMode: string
    provideClusterInfo: boolean
}
