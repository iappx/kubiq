import { InjectableStore, StoreBase } from '@/lib/vue-store'
import { TToast } from '@/application/services/toast/types/TToast'

@InjectableStore
export class ToastStore extends StoreBase<ToastStore> {
    public items: TToast[] = []

    public add(toast: TToast): void {
        this.items.push(toast)
    }

    public bump(id: string): boolean {
        const toast = this.items.find(item => item.id === id)
        if (!toast) {
            return false
        }

        toast.count = (toast.count ?? 1) + 1

        return true
    }

    public remove(id: string): void {
        const index = this.items.findIndex(t => t.id === id)
        if (index !== -1) {
            this.items.splice(index, 1)
        }
    }
}
