import { inject, injectable } from 'tsyringe'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeDiscovery, KubeResourceKind } from '@/domain/models/kube'
import { KubeDiscoveryAdapter } from '@/infrastructure/kube/KubeDiscoveryAdapter'

@injectable()
export class ClusterDiscoveryService {
    private static readonly notConnected = 'That cluster is not connected'

    constructor(
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
        @inject(KubeDiscoveryAdapter) private readonly discovery: KubeDiscoveryAdapter,
    ) {}

    public async listKinds(clusterId: string): Promise<KubeResourceKind[]> {
        const connection = this.connectionService.connection(clusterId)
        if (!connection) {
            throw new ApiError(
                ClusterDiscoveryService.notConnected,
                `No open session for "${clusterId}" — connect to it from the cluster catalog first`,
            )
        }

        const input = await this.discovery.read(clusterId, connection.sessionId)

        return KubeDiscovery.discover(input)
    }
}
