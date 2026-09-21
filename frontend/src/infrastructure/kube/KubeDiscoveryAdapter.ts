import { inject, singleton } from 'tsyringe'
import type { TRestResponse } from '@iappx/entity-repo-rest'
import { KubeDiscovery } from '@/domain/models/kube/discovery/KubeDiscovery'
import type { TApiGroupListDocument } from '@/domain/models/kube/discovery/types/TApiGroupListDocument'
import type { TApiResourceListDocument } from '@/domain/models/kube/discovery/types/TApiResourceListDocument'
import type { TApiVersionsDocument } from '@/domain/models/kube/discovery/types/TApiVersionsDocument'
import type { TKubeDiscoveryInput } from '@/domain/models/kube/discovery/types/TKubeDiscoveryInput'
import { KubeContextProvider } from '@/infrastructure/entityRepo/kube/KubeContextProvider'
import { KubeTransport } from '@/infrastructure/entityRepo/kube/transport/KubeTransport'

@singleton()
export class KubeDiscoveryAdapter {
    public static readonly coreVersionsPath: string = '/api'

    public static readonly groupsPath: string = '/apis'

    constructor(
        @inject(KubeContextProvider) private readonly contexts: KubeContextProvider,
    ) {}

    public async read(clusterId: string, sessionId: string): Promise<TKubeDiscoveryInput> {
        const transport = this.contexts.request(clusterId, sessionId)

        const [coreVersions, groups] = await Promise.all([
            KubeDiscoveryAdapter.get<TApiVersionsDocument>(transport, KubeDiscoveryAdapter.coreVersionsPath),
            KubeDiscoveryAdapter.get<TApiGroupListDocument>(transport, KubeDiscoveryAdapter.groupsPath),
        ])

        const input: TKubeDiscoveryInput = { coreVersions, groups }
        const resourceLists = await KubeDiscoveryAdapter.readResourceLists(
            transport,
            KubeDiscovery.preferredVersions(input),
        )

        return { ...input, resourceLists }
    }

    public static basePath(group: string, version: string): string {
        return group.length > 0
            ? `${KubeDiscoveryAdapter.groupsPath}/${group}/${version}`
            : `${KubeDiscoveryAdapter.coreVersionsPath}/${version}`
    }

    // One refused or broken group must not cost the user every other kind, so a
    // failed list is dropped rather than propagated.
    private static async readResourceLists(
        transport: KubeTransport,
        preferred: Map<string, string>,
    ): Promise<TApiResourceListDocument[]> {
        const paths: string[] = []
        preferred.forEach((version, group) => {
            paths.push(KubeDiscoveryAdapter.basePath(group, version))
        })

        const answered = await Promise.all(
            paths.map(path => KubeDiscoveryAdapter.get<TApiResourceListDocument>(transport, path)),
        )

        return answered.filter((list): list is TApiResourceListDocument => list !== undefined)
    }

    private static async get<T>(transport: KubeTransport, url: string): Promise<T | undefined> {
        try {
            const response = await transport.send<TRestResponse<T | undefined>>({ method: 'GET', url })
            return response?.data ?? undefined
        } catch {
            return undefined
        }
    }
}
