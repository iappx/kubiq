import { inject, singleton } from 'tsyringe'
import { ToastService } from '@/application/services/toast/ToastService'
import { AppConnectivityEvent } from '@/domain/events/app/AppConnectivityEvent'
import { ClusterHealthChangedEvent } from '@/domain/events/cluster/ClusterHealthChangedEvent'
import { ClusterHealthCatalog } from '@/domain/models/kube/failure/ClusterHealthCatalog'
import { ConnectivityService } from '@/infrastructure/connectivity/ConnectivityService'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ClusterHealthStore } from '@/store/modules/clusterHealth/ClusterHealthStore'

@singleton()
export class ClusterHealthHandler {
    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(ConnectivityService) private readonly connectivity: ConnectivityService,
        @inject(ToastService) private readonly toastService: ToastService,
        @inject(ClusterHealthStore) private readonly healthStore: ClusterHealthStore,
    ) {
        this.eventBus.registerHandler(ClusterHealthChangedEvent, e => this.apply(e))
        this.eventBus.registerHandler(AppConnectivityEvent, e => this.announce(e))

        this.connectivity.start()
        this.healthStore.setOnline(this.connectivity.isOnline)
    }

    private apply(event: ClusterHealthChangedEvent): void {
        this.healthStore.set(event.clusterId, event.health, event.detail)
    }

    // Only this one raises a toast: a cluster-side failure already travelled as an ApiError
    // and was announced by ErrorHandler, but losing the network refuses no request at all.
    private announce(event: AppConnectivityEvent): void {
        this.healthStore.setOnline(event.online)

        if (event.online) {
            this.toastService.success('Back online', 'Live lists reconnect on their own.')
            return
        }

        const notice = ClusterHealthCatalog.offlineNotice()
        this.toastService.show({ type: 'warning', message: notice.title, description: notice.description })
    }
}
