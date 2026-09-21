import { inject, singleton } from 'tsyringe'
import { KubeSchemaBuilder } from '@/application/services/kubeSchema/models/KubeSchemaBuilder'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import type { KubeResourceKind } from '@/domain/models/kube'
import { KubeOpenApiAdapter } from '@/infrastructure/kube/KubeOpenApiAdapter'
import type { TKubeOpenApiDocument } from '@/infrastructure/kube/types/TKubeOpenApiDocument'

@singleton()
export class KubeSchemaService {
    private readonly documents = new Map<string, Promise<TKubeOpenApiDocument | undefined>>()

    constructor(
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
        @inject(KubeOpenApiAdapter) private readonly openApi: KubeOpenApiAdapter,
    ) {}

    public static keyOf(clusterId: string, kind: KubeResourceKind): string {
        return `${clusterId}|${kind.group}/${kind.version}`
    }

    public async forKind(clusterId: string, kind: KubeResourceKind): Promise<Record<string, unknown> | undefined> {
        return KubeSchemaBuilder.forKind(await this.document(clusterId, kind), kind)
    }

    public forget(clusterId: string): void {
        const prefix = `${clusterId}|`
        const stale = [...this.documents.keys()].filter(key => key.startsWith(prefix))

        stale.forEach(key => this.documents.delete(key))
    }

    // The promise is what is cached, not the answer: two tabs opening at once
    // would otherwise each fetch the same few hundred kilobytes.
    private document(clusterId: string, kind: KubeResourceKind): Promise<TKubeOpenApiDocument | undefined> {
        const key = KubeSchemaService.keyOf(clusterId, kind)
        const known = this.documents.get(key)
        if (known) {
            return known
        }

        const connection = this.connectionService.connection(clusterId)
        if (!connection) {
            return Promise.resolve(undefined)
        }

        const reading = this.openApi.read(clusterId, connection.sessionId, kind.group, kind.version)
        this.documents.set(key, reading)

        return reading
    }
}
