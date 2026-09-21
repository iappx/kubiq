import type { TDetailCondition } from '@/components/resource/detail/types/TDetailCondition'
import type { TUiTone } from '@/components/common/status/types/TUiTone'
import { KubeManifest } from '@/domain/models/kube'

export class DetailConditions {
    public static of(object: Record<string, unknown>): TDetailCondition[] {
        const status = KubeManifest.isObject(object.status) ? object.status : {}
        const conditions = status.conditions
        if (!Array.isArray(conditions)) {
            return []
        }

        return conditions
            .filter((condition): condition is Record<string, unknown> => KubeManifest.isObject(condition))
            .map(condition => ({
                type: DetailConditions.text(condition.type),
                status: DetailConditions.text(condition.status),
                reason: DetailConditions.text(condition.reason),
                message: DetailConditions.text(condition.message),
                tone: DetailConditions.toneOf(DetailConditions.text(condition.status)),
            }))
            .filter(condition => condition.type !== '')
    }

    // True is not health — DiskPressure=True is bad — so the tone marks only whether the condition holds.
    public static toneOf(status: string): TUiTone {
        if (status === 'True') {
            return 'info'
        }

        return status === 'False' ? 'pending' : 'unknown'
    }

    private static text(value: unknown): string {
        return typeof value === 'string' ? value : ''
    }
}
