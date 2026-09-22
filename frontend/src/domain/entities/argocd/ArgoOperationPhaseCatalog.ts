import type { TArgoOperationPhase } from '@/domain/entities/argocd/types/TArgoOperationPhase'

export class ArgoOperationPhaseCatalog {
    private static readonly titles: Record<TArgoOperationPhase, string> = {
        Running: 'Running',
        Terminating: 'Terminating',
        Failed: 'Failed',
        Error: 'Error',
        Succeeded: 'Succeeded',
    }

    private static readonly live: TArgoOperationPhase[] = ['Running', 'Terminating']

    public static has(phase: string): boolean {
        return Object.prototype.hasOwnProperty.call(ArgoOperationPhaseCatalog.titles, phase)
    }

    public static title(phase: TArgoOperationPhase): string {
        return ArgoOperationPhaseCatalog.titles[phase] ?? phase
    }

    public static read(value: unknown): TArgoOperationPhase | undefined {
        return typeof value === 'string' && ArgoOperationPhaseCatalog.has(value)
            ? value as TArgoOperationPhase
            : undefined
    }

    public static isLive(phase: TArgoOperationPhase | undefined): boolean {
        return phase !== undefined && ArgoOperationPhaseCatalog.live.includes(phase)
    }

    public static isFailure(phase: TArgoOperationPhase | undefined): boolean {
        return phase === 'Failed' || phase === 'Error'
    }
}
