import type { TRequestContext } from '@iappx/entity-repo-rest'
import { MetricsObjectKey } from '@/domain/entities/metrics'
import { KubeListResponseAdapter } from '@/infrastructure/entityRepo/kube/strategies/KubeListResponseAdapter'

// metrics.k8s.io answers with objects that carry no uid, so the primary key every
// entity needs has to be built from the name the response does carry.
export class MetricsResponseAdapter extends KubeListResponseAdapter {
    protected decorate(item: Record<string, unknown>, context: TRequestContext): Record<string, unknown> {
        const decorated = super.decorate(item, context)
        const metadata = decorated.metadata as Record<string, unknown> | undefined
        const name = typeof metadata?.name === 'string' ? metadata.name : ''
        const namespace = typeof metadata?.namespace === 'string' ? metadata.namespace : ''

        return { ...decorated, key: MetricsObjectKey.of(namespace, name) }
    }
}
