import { FilterFactory, QueryOperators } from '@iappx/entity-repo-query'
import type { TFilterNode } from '@iappx/entity-repo-query'
import { KubeSelectorPath } from '@/domain/entities/kube/KubeSelectorPath'
import type { TKubeLabels } from '@/domain/entities/kube/types/TKubeLabels'

// The API server filters only by labelSelector and fieldSelector, both equality over a dotted path, so these
// use opPath with eq rather than the typed key helpers, which cannot reach inside metadata.
export class KubeFilters {
    public static named<T>(filter: FilterFactory<T>, name: string): TFilterNode {
        return filter.opPath(QueryOperators.eq, KubeSelectorPath.namePath(), name)
    }

    public static inNamespace<T>(filter: FilterFactory<T>, namespace: string): TFilterNode {
        return filter.opPath(QueryOperators.eq, KubeSelectorPath.namespacePath(), namespace)
    }

    public static withLabel<T>(filter: FilterFactory<T>, key: string, value: string): TFilterNode {
        return filter.opPath(QueryOperators.eq, KubeSelectorPath.labelPath(key), value)
    }

    public static withLabels<T>(filter: FilterFactory<T>, labels: TKubeLabels): TFilterNode {
        return filter.and(...Object.keys(labels).map(key => KubeFilters.withLabel(filter, key, labels[key])))
    }
}
