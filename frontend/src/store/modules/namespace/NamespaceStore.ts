import { inject } from 'tsyringe'
import { NamespaceService } from '@/application/services/namespace/NamespaceService'
import type { TNamespaceCreateRequest } from '@/application/services/namespace/types/TNamespaceCreateRequest'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { NamespaceCreatedEvent } from '@/domain/events/cluster/NamespaceCreatedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { InjectableStore, StoreBase } from '@/lib/vue-store'

@InjectableStore
export class NamespaceStore extends StoreBase<NamespaceStore> {
    public creating = false

    constructor(
        @inject(NamespaceService) private readonly namespaceService: NamespaceService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public async create(request: TNamespaceCreateRequest): Promise<boolean> {
        this.creating = true

        try {
            const name = await this.namespaceService.create(request)
            this.eventBus.emitEvent(new NamespaceCreatedEvent(request.clusterId, name))
            return true
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'NamespaceStore.create'))
            return false
        } finally {
            this.creating = false
        }
    }
}
