import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'

export class KubeObjectStateCatalog {
    public static readonly values: Record<TKubeObjectState, string> = {
        ok: 'Healthy',
        pending: 'Pending',
        warning: 'Warning',
        error: 'Error',
        unknown: 'Unknown',
    }

    public static title(state: TKubeObjectState): string {
        return KubeObjectStateCatalog.values[state] ?? state
    }

    public static has(state: string): boolean {
        return Object.prototype.hasOwnProperty.call(KubeObjectStateCatalog.values, state)
    }

    public static isProblematic(state: TKubeObjectState): boolean {
        return state === 'warning' || state === 'error'
    }
}
