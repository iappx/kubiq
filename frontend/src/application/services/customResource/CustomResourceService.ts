import { inject, injectable } from 'tsyringe'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { KubeCrdReader } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'
import { KubeCrdAdapter } from '@/infrastructure/kube/KubeCrdAdapter'
import { KubeStatusReader } from '@/infrastructure/entityRepo/kube/transport/KubeStatusReader'

@injectable()
export class CustomResourceService {
    constructor(
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
        @inject(KubeCrdAdapter) private readonly crds: KubeCrdAdapter,
    ) {}

    public static definesColumns(kind: KubeResourceKind): boolean {
        return kind.isCustom && kind.group !== '' && kind.resource !== ''
    }

    // A cluster that refuses the definition, or has none, is answered with null: the
    // list still opens, it just keeps the Name / Namespace / Age columns discovery gave it.
    public async printerColumns(clusterId: string, kind: KubeResourceKind): Promise<KubeResourceKind | null> {
        const connection = this.connectionService.connection(clusterId)
        if (!connection || !CustomResourceService.definesColumns(kind)) {
            return null
        }

        const name = KubeCrdAdapter.nameOf(kind.group, kind.resource)

        try {
            const document = await this.crds.read(clusterId, connection.sessionId, name)
            const defined = document ? KubeCrdReader.read(document) : []
            const match = defined.find(candidate => candidate.version === kind.version) ?? defined[0]

            return match ? kind.withDefinition({ columns: match.columns, isCustom: true }) : null
        } catch (err) {
            if (KubeStatusReader.isForbidden(err) || KubeStatusReader.isMissing(err)) {
                return null
            }
            throw err
        }
    }
}
