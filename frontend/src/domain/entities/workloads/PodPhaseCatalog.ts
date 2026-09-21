import type { TPodPhase } from '@/domain/entities/workloads/types/TPodPhase'

export class PodPhaseCatalog {
    public static readonly values: Record<TPodPhase, string> = {
        Pending: 'Pending',
        Running: 'Running',
        Succeeded: 'Succeeded',
        Failed: 'Failed',
        Unknown: 'Unknown',
    }

    public static title(phase: TPodPhase): string {
        return PodPhaseCatalog.values[phase] ?? phase
    }

    public static has(phase: string): boolean {
        return Object.prototype.hasOwnProperty.call(PodPhaseCatalog.values, phase)
    }
}
