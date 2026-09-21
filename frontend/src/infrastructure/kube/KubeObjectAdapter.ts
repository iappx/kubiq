import { inject, singleton } from 'tsyringe'
import type { TRestResponse } from '@iappx/entity-repo-rest'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeContextProvider } from '@/infrastructure/entityRepo/kube/KubeContextProvider'

// Reads raw rather than through an entity: an entity is a field map, so it would
// hand the editor a manifest with everything it cannot name dropped.
@singleton()
export class KubeObjectAdapter {
    public static readonly emptyAnswer: string = 'The cluster answered with no object'

    constructor(
        @inject(KubeContextProvider) private readonly contexts: KubeContextProvider,
    ) {}

    public async read(clusterId: string, sessionId: string, path: string): Promise<Record<string, unknown>> {
        const response = await this.contexts
            .request(clusterId, sessionId)
            .send<TRestResponse<unknown>>({ method: 'GET', url: path })

        const data = response?.data
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new ApiError(KubeObjectAdapter.emptyAnswer, `GET ${path} returned no object body`)
        }

        return data as Record<string, unknown>
    }
}
