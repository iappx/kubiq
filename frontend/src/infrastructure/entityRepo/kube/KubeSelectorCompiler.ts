import type { FilterFactory, TFilterNode } from '@iappx/entity-repo-query'
import type { RepoEntityBase } from '@iappx/entity-repo'
import type { KubeResourceKind } from '@/domain/models/kube'
import { KubeApiParams } from '@/infrastructure/entityRepo/kube/KubeApiParams'
import { KubeEntitySets } from '@/infrastructure/entityRepo/kube/KubeEntitySets'
import type { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import type { TKubeSelectors } from '@/infrastructure/entityRepo/kube/types/TKubeSelectors'

export class KubeSelectorCompiler {
    public static compile(
        context: KubeEntityContext,
        kind: KubeResourceKind,
        build: (filter: FilterFactory<RepoEntityBase>) => TFilterNode,
    ): TKubeSelectors {
        const params = KubeEntitySets.queryFor(context, kind).where(build).compile().params

        return {
            labelSelector: KubeSelectorCompiler.text(params[KubeApiParams.labelSelector]),
            fieldSelector: KubeSelectorCompiler.text(params[KubeApiParams.fieldSelector]),
        }
    }

    private static text(value: unknown): string {
        if (Array.isArray(value)) {
            return value.map(item => String(item)).join(',')
        }

        return value === undefined || value === null ? '' : String(value)
    }
}
