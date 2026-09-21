import { InjectableStore, StoreBase } from '@/lib/vue-store'

@InjectableStore
export class RouterNavigationStore extends StoreBase<RouterNavigationStore> {
    public navigating = false
}
