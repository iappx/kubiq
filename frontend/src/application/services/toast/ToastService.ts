import { inject, singleton } from 'tsyringe'
import { IdService } from '@/application/services/id/IdService'
import { ToastStore } from '@/store/modules/toast/ToastStore'
import { TToast } from '@/application/services/toast/types/TToast'

@singleton()
export class ToastService {
    private static readonly DismissDelay = 4000

    private static readonly MaxVisible = 5

    private readonly live = new Map<string, string>()

    constructor(
        @inject(ToastStore) private readonly toastStore: ToastStore,
        @inject(IdService) private readonly idService: IdService,
    ) {}

    public success(message: string, description?: string): void {
        this.show({ type: 'success', message, description })
    }

    public error(message: string, description?: string): void {
        this.show({ type: 'error', message, description })
    }

    public show(toast: Omit<TToast, 'id'>): void {
        const signature = ToastService.signatureOf(toast)
        if (this.repeat(signature)) {
            return
        }

        const id = this.idService.next()
        this.live.set(signature, id)
        this.toastStore.add({ ...toast, id, count: 1 })
        this.trim()

        // An error stays until it is dismissed: it is the one kind the user may still need to act on.
        if (toast.type !== 'error') {
            setTimeout(() => this.dismiss(signature, id), ToastService.DismissDelay)
        }
    }

    private dismiss(signature: string, id: string): void {
        if (this.live.get(signature) === id) {
            this.live.delete(signature)
        }

        this.toastStore.remove(id)
    }

    private repeat(signature: string): boolean {
        const id = this.live.get(signature)
        if (id === undefined) {
            return false
        }

        if (this.toastStore.bump(id)) {
            return true
        }

        this.live.delete(signature)

        return false
    }

    private trim(): void {
        while (this.toastStore.items.length > ToastService.MaxVisible) {
            const oldest = this.toastStore.items[0]
            this.dismiss(ToastService.signatureOf(oldest), oldest.id)
        }
    }

    private static signatureOf(toast: Omit<TToast, 'id'>): string {
        return `${toast.type}|${toast.message}`
    }
}
