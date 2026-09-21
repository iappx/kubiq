import { FilterFactory, QueryOperators } from '@iappx/entity-repo-query'
import type { TFilterNode } from '@iappx/entity-repo-query'
import { KubeFilters } from '@/domain/entities/kube/KubeFilters'

export class NodeFilters {
    public static readonly rolePrefix: string = 'node-role.kubernetes.io/'

    public static schedulable<T>(filter: FilterFactory<T>): TFilterNode {
        return filter.opPath(QueryOperators.eq, ['spec', 'unschedulable'], false)
    }

    public static cordoned<T>(filter: FilterFactory<T>): TFilterNode {
        return filter.opPath(QueryOperators.eq, ['spec', 'unschedulable'], true)
    }

    // The role marker is a label whose presence is what matters; Kubernetes
    // writes it with an empty value, which is what a selector matches on.
    public static withRole<T>(filter: FilterFactory<T>, role: string): TFilterNode {
        return KubeFilters.withLabel(filter, `${NodeFilters.rolePrefix}${role}`, '')
    }
}
