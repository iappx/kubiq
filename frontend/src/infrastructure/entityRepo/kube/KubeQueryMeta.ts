import type { TQueryMeta } from '@iappx/entity-repo-query'
import { KubeResourceKind } from '@/domain/models/kube'

export class KubeQueryMeta {
    public static readonly kindKey: string = 'kubeKind'

    public static forKind(kind: KubeResourceKind): TQueryMeta {
        return { [KubeQueryMeta.kindKey]: kind }
    }

    public static kindOf(meta?: TQueryMeta): KubeResourceKind | undefined {
        const kind = meta ? meta[KubeQueryMeta.kindKey] : undefined
        return kind instanceof KubeResourceKind ? kind : undefined
    }
}
