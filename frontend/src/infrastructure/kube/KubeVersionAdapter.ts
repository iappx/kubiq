import { inject, singleton } from 'tsyringe'
import type { TRestResponse } from '@iappx/entity-repo-rest'
import { KubeServerVersion } from '@/domain/models/kube/discovery/KubeServerVersion'
import type { TKubeVersionDocument } from '@/domain/models/kube/discovery/types/TKubeVersionDocument'
import { KubeContextProvider } from '@/infrastructure/entityRepo/kube/KubeContextProvider'

@singleton()
export class KubeVersionAdapter {
    public static readonly path: string = '/version'

    constructor(
        @inject(KubeContextProvider) private readonly contexts: KubeContextProvider,
    ) {}

    public async read(clusterId: string, sessionId: string): Promise<KubeServerVersion> {
        try {
            const response = await this.contexts
                .request(clusterId, sessionId)
                .send<TRestResponse<TKubeVersionDocument | undefined>>({
                    method: 'GET',
                    url: KubeVersionAdapter.path,
                })

            return KubeServerVersion.read(response?.data)
        } catch {
            return KubeServerVersion.unknown()
        }
    }
}
