import type { TExecutableLocation } from '@/application/services/executable/types/TExecutableLocation'

export type TLocalShellPlan = {
    command: string
    args: string[]
    env: Record<string, string>
    kubectl: TExecutableLocation
}
