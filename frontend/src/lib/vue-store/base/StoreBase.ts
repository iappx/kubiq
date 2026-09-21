import { ISetupStore } from '@/lib/vue-store'
import { Store } from 'pinia-class-transformer'

export abstract class StoreBase<T extends Record<string, any>> extends Store<T> implements ISetupStore {

    setup(): void {
        // Runs on every resolution of the store — override for one-shot work
        // only if it is idempotent, and never to subscribe to the event bus.
    }
}
