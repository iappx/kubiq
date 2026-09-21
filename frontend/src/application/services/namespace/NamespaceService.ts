import { inject, injectable } from 'tsyringe'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import type { TNamespaceCreateRequest } from '@/application/services/namespace/types/TNamespaceCreateRequest'
import { KubeEntitySets } from '@/infrastructure/entityRepo/kube/KubeEntitySets'

@injectable()
export class NamespaceService {
    constructor(
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
    ) {}

    public async create(request: TNamespaceCreateRequest): Promise<string> {
        const query = KubeEntitySets.queryFor(this.connectionService.context(request.clusterId), request.kind)

        const namespace = query.entityConstructor.build({})
        namespace.setDataValue('apiVersion', request.kind.apiVersion)
        namespace.setDataValue('kind', request.kind.kind)
        namespace.setDataValue('metadata', { name: request.name })

        const created = await query.create(namespace)
        const name = (created as unknown as Record<string, unknown>).name

        return typeof name === 'string' && name !== '' ? name : request.name
    }
}
