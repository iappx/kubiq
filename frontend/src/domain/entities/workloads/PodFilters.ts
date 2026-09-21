import { FilterFactory, QueryOperators } from '@iappx/entity-repo-query'
import type { TFilterNode } from '@iappx/entity-repo-query'
import { KubeFilters } from '@/domain/entities/kube/KubeFilters'
import type { TPodPhase } from '@/domain/entities/workloads/types/TPodPhase'

// Only paths the API server accepts in a pod fieldSelector: it rejects a list filtered on anything else.
export class PodFilters {
    public static onNode<T>(filter: FilterFactory<T>, nodeName: string): TFilterNode {
        return filter.opPath(QueryOperators.eq, ['spec', 'nodeName'], nodeName)
    }

    public static withPhase<T>(filter: FilterFactory<T>, phase: TPodPhase): TFilterNode {
        return filter.opPath(QueryOperators.eq, ['status', 'phase'], phase)
    }

    public static running<T>(filter: FilterFactory<T>): TFilterNode {
        return PodFilters.withPhase(filter, 'Running')
    }

    public static failed<T>(filter: FilterFactory<T>): TFilterNode {
        return PodFilters.withPhase(filter, 'Failed')
    }

    public static ofServiceAccount<T>(filter: FilterFactory<T>, serviceAccountName: string): TFilterNode {
        return filter.opPath(QueryOperators.eq, ['spec', 'serviceAccountName'], serviceAccountName)
    }

    public static runningOnNode<T>(filter: FilterFactory<T>, nodeName: string): TFilterNode {
        return filter.and(PodFilters.onNode(filter, nodeName), PodFilters.running(filter))
    }

    public static onNodeInNamespace<T>(filter: FilterFactory<T>, nodeName: string, namespace: string): TFilterNode {
        return filter.and(PodFilters.onNode(filter, nodeName), KubeFilters.inNamespace(filter, namespace))
    }
}
