import type { TPersistentVolumePhase } from '@/domain/entities/storage/types/TPersistentVolumePhase'

export type TPersistentVolumeStatus = {
    phase?: TPersistentVolumePhase
    reason?: string
    message?: string
}
