import type { RepoEntityBase } from '@iappx/entity-repo'
import { KubeObjectStateCatalog } from '@/domain/entities/kube/KubeObjectStateCatalog'
import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'

export class KubeObjectHealth {
    public static hasState(entity: RepoEntityBase): boolean {
        const state = (entity as unknown as Record<string, unknown>).state

        return typeof state === 'string' && KubeObjectStateCatalog.has(state)
    }

    public static stateOf(entity: RepoEntityBase): TKubeObjectState {
        const state = (entity as unknown as Record<string, unknown>).state

        return typeof state === 'string' && KubeObjectStateCatalog.has(state)
            ? state as TKubeObjectState
            : 'unknown'
    }

    public static labelOf(entity: RepoEntityBase): string {
        const label = (entity as unknown as Record<string, unknown>).stateLabel
        if (typeof label === 'string' && label.length > 0) {
            return label
        }

        return KubeObjectStateCatalog.title(KubeObjectHealth.stateOf(entity))
    }

    public static isProblematic(entity: RepoEntityBase): boolean {
        return KubeObjectStateCatalog.isProblematic(KubeObjectHealth.stateOf(entity))
    }

    public static countProblems(entities: readonly RepoEntityBase[]): number {
        return entities.reduce((count, entity) => count + (KubeObjectHealth.isProblematic(entity) ? 1 : 0), 0)
    }
}
