import { inject, singleton } from 'tsyringe'
import { IdService } from '@/application/services/id/IdService'
import { ToastStore } from '@/store/modules/toast/ToastStore'
import { TToast } from '@/application/services/toast/types/TToast'

@singleton()
export class ToastService {
    private static readonly DismissDelay = 4000

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
        const id = this.idService.next()
        this.toastStore.add({ ...toast, id })
        setTimeout(() => this.toastStore.remove(id), ToastService.DismissDelay)
    }
}
