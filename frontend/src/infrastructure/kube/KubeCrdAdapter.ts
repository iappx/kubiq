import { inject, singleton } from 'tsyringe'
import type { TRestResponse } from '@iappx/entity-repo-rest'
import type { TCustomResourceDefinitionDocument } from '@/domain/models/kube'
import { KubeContextProvider } from '@/infrastructure/entityRepo/kube/KubeContextProvider'

// One definition at a time, by name. Listing the collection would pull every CRD
// document in the cluster — megabytes on a cluster with a few hundred of them.
@singleton()
export class KubeCrdAdapter {
    public static readonly basePath: string = '/apis/apiextensions.k8s.io/v1/customresourcedefinitions'

    constructor(
        @inject(KubeContextProvider) private readonly contexts: KubeContextProvider,
    ) {}

    public static nameOf(group: string, resource: string): string {
        return `${resource}.${group}`
    }

    public async read(
        clusterId: string,
        sessionId: string,
        name: string,
    ): Promise<TCustomResourceDefinitionDocument | undefined> {
        const response = await this.contexts
            .request(clusterId, sessionId)
            .send<TRestResponse<TCustomResourceDefinitionDocument | undefined>>({
                method: 'GET',
                url: `${KubeCrdAdapter.basePath}/${name}`,
            })

        return response?.data ?? undefined
    }
}
