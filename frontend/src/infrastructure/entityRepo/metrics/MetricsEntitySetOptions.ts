import type { TRestQueryOptions } from '@iappx/entity-repo-rest'
import type { KubeResourceKind } from '@/domain/models/kube'
import { MetricsKinds } from '@/domain/models/metrics'
import { KubeEntitySetOptions } from '@/infrastructure/entityRepo/kube/KubeEntitySetOptions'
import { MetricsResponseAdapter } from '@/infrastructure/entityRepo/metrics/strategies/MetricsResponseAdapter'

export class MetricsEntitySetOptions {
    public static nodes(): TRestQueryOptions {
        return MetricsEntitySetOptions.forKind(MetricsKinds.nodes())
    }

    public static pods(): TRestQueryOptions {
        return MetricsEntitySetOptions.forKind(MetricsKinds.pods())
    }

    private static forKind(kind: KubeResourceKind): TRestQueryOptions {
        return { ...KubeEntitySetOptions.forKind(kind), responseAdapter: new MetricsResponseAdapter() }
    }
}
