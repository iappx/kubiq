import { ISetupStore } from '@/lib/vue-store'
import { Store } from 'pinia-class-transformer'

export abstract class StoreBase<T extends Record<string, any>> extends Store<T> implements ISetupStore {

    setup(): void {
        // Runs on every resolution of the store: an override has to be idempotent,
        // and must never subscribe to the event bus.
    }
}
