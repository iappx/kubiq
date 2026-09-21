import type { TResourceChange } from '@/application/services/resourceWatch/types/TResourceChange'

export type TResourceWatchHandlers = {
    onChanges(changes: readonly TResourceChange[]): void
    onResync(): void
    onStale(at: number): void
}
