import type { TPersistentVolumePhase } from '@/domain/entities/storage/types/TPersistentVolumePhase'

export class PersistentVolumePhaseCatalog {
    public static readonly values: Record<TPersistentVolumePhase, string> = {
        Pending: 'Pending',
        Available: 'Available',
        Bound: 'Bound',
        Released: 'Released',
        Failed: 'Failed',
    }

    public static title(phase: TPersistentVolumePhase): string {
        return PersistentVolumePhaseCatalog.values[phase] ?? phase
    }

    public static has(phase: string): boolean {
        return Object.prototype.hasOwnProperty.call(PersistentVolumePhaseCatalog.values, phase)
    }
}
