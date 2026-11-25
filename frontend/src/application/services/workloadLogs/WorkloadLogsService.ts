import { inject, injectable } from 'tsyringe'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { ResourceYamlService } from '@/application/services/resourceYaml/ResourceYamlService'
import { WorkloadPodSelector } from '@/application/services/workloadLogs/models/WorkloadPodSelector'
import type { TWorkloadPodChoice } from '@/application/services/workloadLogs/types/TWorkloadPodChoice'
import { KubeObjectHealth } from '@/domain/entities/kube'
import type { PodEntity } from '@/domain/entities/workloads'
import type { KubeResourceKind } from '@/domain/models/kube'
import { KubeApiParams } from '@/infrastructure/entityRepo/kube/KubeApiParams'
import { KubeUrlBuilder } from '@/infrastructure/entityRepo/kube/strategies/KubeUrlBuilder'

@injectable()
export class WorkloadLogsService {
    constructor(
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
        @inject(ResourceYamlService) private readonly yamlService: ResourceYamlService,
    ) {}

    public async podsOf(
        clusterId: string,
        kind: KubeResourceKind,
        name: string,
        namespace: string,
    ): Promise<TWorkloadPodChoice[]> {
        const object = await this.yamlService.read({ clusterId, kind, name, namespace })
        const labelSelector = WorkloadPodSelector.labelSelectorFor(kind, object)
        if (labelSelector === '') {
            return []
        }

        let query = this.connectionService.context(clusterId).pods
        if (namespace !== '') {
            query = query.withPathParams({ [KubeUrlBuilder.namespaceParam]: namespace })
        }

        const pods = await query
            .rawFilter({ [KubeApiParams.labelSelector]: labelSelector })
            .getAll()

        return WorkloadPodSelector.sortPods(pods).map(pod => WorkloadLogsService.toChoice(pod, namespace))
    }

    private static toChoice(pod: PodEntity, fallbackNamespace: string): TWorkloadPodChoice {
        return {
            name: pod.name,
            namespace: pod.namespace || fallbackNamespace,
            phase: pod.phase,
            tone: KubeObjectHealth.stateOf(pod),
            nodeName: pod.nodeName,
            containers: (pod.spec?.containers ?? [])
                .map(container => container.name)
                .filter(name => name !== ''),
        }
    }
}
