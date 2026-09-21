import type { TNodeDrainFailure } from '@/application/services/node/types/TNodeDrainFailure'

export type TNodeDrainResult = {
    evicted: number
    skipped: number
    failures: TNodeDrainFailure[]
}
