import type { TPersistentVolumeClaimPhase } from '@/domain/entities/storage/types/TPersistentVolumeClaimPhase'

export class PersistentVolumeClaimPhaseCatalog {
    public static readonly values: Record<TPersistentVolumeClaimPhase, string> = {
        Pending: 'Pending',
        Bound: 'Bound',
        Lost: 'Lost',
    }

    public static title(phase: TPersistentVolumeClaimPhase): string {
        return PersistentVolumeClaimPhaseCatalog.values[phase] ?? phase
    }

    public static has(phase: string): boolean {
        return Object.prototype.hasOwnProperty.call(PersistentVolumeClaimPhaseCatalog.values, phase)
    }
}
