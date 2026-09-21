import { InjectableStore, StoreBase } from '@/lib/vue-store'
import { TToast } from '@/application/services/toast/types/TToast'

@InjectableStore
export class ToastStore extends StoreBase<ToastStore> {
    public items: TToast[] = []

    public add(toast: TToast): void {
        this.items.push(toast)
    }

    public remove(id: string): void {
        const index = this.items.findIndex(t => t.id === id)
        if (index !== -1) {
            this.items.splice(index, 1)
        }
    }
}
