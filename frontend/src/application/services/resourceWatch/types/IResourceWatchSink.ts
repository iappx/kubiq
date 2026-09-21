import type { TResourceChange } from '@/application/services/resourceWatch/types/TResourceChange'

export interface IResourceWatchSink {
    accept(change: TResourceChange): void

    resync(): void

    stale(): void
}
