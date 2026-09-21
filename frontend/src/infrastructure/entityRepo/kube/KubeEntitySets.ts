import type { RepoEntityBase } from '@iappx/entity-repo'
import type { RestEntityQuery } from '@iappx/entity-repo-rest'
import type { KubeResourceKind } from '@/domain/models/kube'
import type { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import { KubeQueryMeta } from '@/infrastructure/entityRepo/kube/KubeQueryMeta'
import { KubeUrlBuilder } from '@/infrastructure/entityRepo/kube/strategies/KubeUrlBuilder'

type TAnyKubeQuery = RestEntityQuery<RepoEntityBase>

export class KubeEntitySets {
    public static readonly genericKey: string = 'resources'

    private static index: Map<string, string> | undefined

    public static queryFor(context: KubeEntityContext, kind: KubeResourceKind, namespace: string = ''): TAnyKubeQuery {
        const key = KubeEntitySets.keyOf(context, kind) ?? KubeEntitySets.genericKey
        const sets = context as unknown as Record<string, TAnyKubeQuery>
        const query = sets[key].withMeta(KubeQueryMeta.forKind(kind))

        return namespace === '' || !kind.namespaced
            ? query
            : query.withPathParams({ [KubeUrlBuilder.namespaceParam]: namespace })
    }

    public static keyOf(context: KubeEntityContext, kind: KubeResourceKind): string | undefined {
        return KubeEntitySets.byRegistryKey(context).get(kind.registryKey)
    }

    public static hasTypedSet(context: KubeEntityContext, kind: KubeResourceKind): boolean {
        return KubeEntitySets.keyOf(context, kind) !== undefined
    }

    private static byRegistryKey(context: KubeEntityContext): Map<string, string> {
        if (KubeEntitySets.index) {
            return KubeEntitySets.index
        }

        const index = new Map<string, string>()
        const declared = context._entitySetInfo ?? {}

        Object.keys(declared).forEach((key) => {
            if (key === KubeEntitySets.genericKey) {
                return
            }
            const declaredKind = KubeQueryMeta.kindOf(declared[key].queryOptions?.meta)
            if (declaredKind) {
                index.set(declaredKind.registryKey, key)
            }
        })

        KubeEntitySets.index = index

        return index
    }
}
