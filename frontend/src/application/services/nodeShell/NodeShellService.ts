import { inject, injectable } from 'tsyringe'
import type { RestEntityQuery } from '@iappx/entity-repo-rest'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { IdService } from '@/application/services/id/IdService'
import { NodeShellDefaults } from '@/application/services/nodeShell/constants/NodeShellDefaults'
import { NodeShellManifest } from '@/application/services/nodeShell/models/NodeShellManifest'
import type { TNodeShellPod } from '@/application/services/nodeShell/types/TNodeShellPod'
import { SettingsService } from '@/application/services/settings/SettingsService'
import { PodEntity } from '@/domain/entities/workloads'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeApiParams } from '@/infrastructure/entityRepo/kube/KubeApiParams'
import { KubeUrlBuilder } from '@/infrastructure/entityRepo/kube/strategies/KubeUrlBuilder'

@injectable()
export class NodeShellService {
    public static readonly notReady: string = 'The node shell pod did not start'

    constructor(
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
        @inject(SettingsService) private readonly settingsService: SettingsService,
        @inject(IdService) private readonly idService: IdService,
    ) {}

    public async create(clusterId: string, nodeName: string): Promise<TNodeShellPod> {
        const pod: TNodeShellPod = {
            name: NodeShellManifest.nameFor(nodeName, this.idService.next()),
            namespace: NodeShellDefaults.namespace,
            nodeName,
            image: await this.settingsService.nodeShellImage(),
        }

        const query = this.pods(clusterId, pod.namespace)
        await query.create(PodEntity.build(NodeShellManifest.document(pod)))

        return pod
    }

    public async waitReady(clusterId: string, pod: TNodeShellPod, now: () => number = Date.now): Promise<void> {
        const deadline = now() + NodeShellDefaults.readyTimeoutMs

        for (;;) {
            const phase = await this.phase(clusterId, pod)
            if (phase === 'Running') {
                return
            }
            if (phase === 'Failed' || phase === 'Succeeded') {
                throw new ApiError(NodeShellService.notReady, `Pod ${pod.namespace}/${pod.name} is ${phase}`)
            }
            if (now() >= deadline) {
                throw new ApiError(
                    NodeShellService.notReady,
                    `Pod ${pod.namespace}/${pod.name} was still ${phase} after ${NodeShellDefaults.readyTimeoutMs / 1000}s`,
                )
            }

            await NodeShellService.pause(NodeShellDefaults.pollIntervalMs)
        }
    }

    public async listNodes(clusterId: string): Promise<string[]> {
        const nodes = await this.connectionService.context(clusterId).nodes.getAll()

        return nodes.map(node => node.name).filter(name => name !== '').sort((left, right) => left.localeCompare(right))
    }

    public async remove(clusterId: string, pod: TNodeShellPod): Promise<void> {
        if (!this.connectionService.isConnected(clusterId)) {
            return
        }

        await this.delete(clusterId, pod.namespace, pod.name)
    }

    // A crash exits the shell but leaves its pod object behind; this is what clears it.
    public async sweep(clusterId: string, keep: readonly string[] = []): Promise<number> {
        if (!this.connectionService.isConnected(clusterId)) {
            return 0
        }

        const stale = await this.pods(clusterId, NodeShellDefaults.namespace)
            .rawFilter({ [KubeApiParams.labelSelector]: NodeShellManifest.selector() })
            .getAll()

        const removable = stale.filter(pod => pod.name !== '' && !keep.includes(pod.name))
        await Promise.allSettled(removable.map(pod => this.delete(clusterId, pod.namespace, pod.name)))

        return removable.length
    }

    private delete(clusterId: string, namespace: string, name: string): Promise<void> {
        return this.pods(clusterId, namespace)
            .withPathParams({ [KubeUrlBuilder.nameParam]: name })
            .delete(name)
    }

    private async phase(clusterId: string, pod: TNodeShellPod): Promise<string> {
        const found = await this.pods(clusterId, pod.namespace)
            .withPathParams({ [KubeUrlBuilder.nameParam]: pod.name })
            .getOne(pod.name)

        return found ? found.phase : 'Unknown'
    }

    private pods(clusterId: string, namespace: string): RestEntityQuery<PodEntity> {
        return this.connectionService.context(clusterId).pods
            .withPathParams({ [KubeUrlBuilder.namespaceParam]: namespace })
    }

    private static pause(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}
