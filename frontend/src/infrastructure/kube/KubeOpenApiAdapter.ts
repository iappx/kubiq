import { inject, singleton } from 'tsyringe'
import type { TRestResponse } from '@iappx/entity-repo-rest'
import { KubeContextProvider } from '@/infrastructure/entityRepo/kube/KubeContextProvider'
import type { TKubeOpenApiDocument } from '@/infrastructure/kube/types/TKubeOpenApiDocument'

@singleton()
export class KubeOpenApiAdapter {
    public static readonly root: string = '/openapi/v3'

    public static pathOf(group: string, version: string): string {
        return group.length > 0
            ? `${KubeOpenApiAdapter.root}/apis/${group}/${version}`
            : `${KubeOpenApiAdapter.root}/api/${version}`
    }

    constructor(
        @inject(KubeContextProvider) private readonly contexts: KubeContextProvider,
    ) {}

    // A cluster older than OpenAPI v3 answers 404 here, and no /openapi/v2 fallback is
    // wanted: that is the whole swagger for every group at once, megabytes for completion.
    public async read(
        clusterId: string,
        sessionId: string,
        group: string,
        version: string,
    ): Promise<TKubeOpenApiDocument | undefined> {
        const transport = this.contexts.request(clusterId, sessionId)
        const url = KubeOpenApiAdapter.pathOf(group, version)

        try {
            const response = await transport.send<TRestResponse<TKubeOpenApiDocument | undefined>>({
                method: 'GET',
                url,
            })

            return response?.data ?? undefined
        } catch {
            return undefined
        }
    }
}
