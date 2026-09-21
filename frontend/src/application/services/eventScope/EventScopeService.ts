import { inject, injectable } from 'tsyringe'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { EventFilters } from '@/domain/entities/cluster'
import type { TEventScope } from '@/domain/entities/cluster'
import type { KubeResourceKind } from '@/domain/models/kube'
import { KubeSelectorCompiler } from '@/infrastructure/entityRepo/kube/KubeSelectorCompiler'

@injectable()
export class EventScopeService {
    constructor(
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
    ) {}

    public fieldSelectorFor(clusterId: string, kind: KubeResourceKind, scope: TEventScope): string {
        if (!EventFilters.isScoped(scope)) {
            return ''
        }

        return KubeSelectorCompiler.compile(
            this.connectionService.context(clusterId),
            kind,
            filter => EventFilters.forScope(filter, scope),
        ).fieldSelector
    }
}
