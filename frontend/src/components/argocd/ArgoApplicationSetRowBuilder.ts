import type { TArgoApplicationSetRow } from '@/components/argocd/types/TArgoApplicationSetRow'
import type { ArgoApplicationSetEntity } from '@/domain/entities/argocd/ArgoApplicationSetEntity'
import { KubeObjectKey, KubeObjectStateCatalog } from '@/domain/entities/kube'

export class ArgoApplicationSetRowBuilder {
    public static build(sets: readonly ArgoApplicationSetEntity[]): TArgoApplicationSetRow[] {
        return sets.map(set => ArgoApplicationSetRowBuilder.row(set))
    }

    public static row(set: ArgoApplicationSetEntity): TArgoApplicationSetRow {
        return {
            key: KubeObjectKey.of(set),
            name: set.name,
            namespace: set.namespace,
            project: set.project,
            generators: set.generatorsText,
            strategy: set.strategy,
            tone: set.state,
            statusText: KubeObjectStateCatalog.title(set.state),
            createdAt: set.createdAt,
        }
    }
}
