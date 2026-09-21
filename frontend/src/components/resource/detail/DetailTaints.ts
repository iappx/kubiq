import type { TDetailTaint } from '@/components/resource/detail/types/TDetailTaint'
import type { TUiTone } from '@/components/common/status/types/TUiTone'
import { KubeManifest } from '@/domain/models/kube'

export class DetailTaints {
    public static readonly noSchedule: string = 'NoSchedule'

    public static readonly noExecute: string = 'NoExecute'

    public static of(object: Record<string, unknown>): TDetailTaint[] {
        const spec = KubeManifest.isObject(object.spec) ? object.spec : {}
        const taints = Array.isArray(spec.taints) ? spec.taints : []

        return taints
            .filter((taint): taint is Record<string, unknown> => KubeManifest.isObject(taint))
            .map(taint => ({
                key: DetailTaints.text(taint.key),
                value: DetailTaints.text(taint.value),
                effect: DetailTaints.text(taint.effect),
                tone: DetailTaints.toneOf(DetailTaints.text(taint.effect)),
            }))
            .filter(taint => taint.key !== '')
    }

    // NoExecute throws running pods off the node, NoSchedule only keeps new ones away.
    public static toneOf(effect: string): TUiTone {
        if (effect === DetailTaints.noExecute) {
            return 'error'
        }

        return effect === DetailTaints.noSchedule ? 'warning' : 'pending'
    }

    private static text(value: unknown): string {
        return typeof value === 'string' ? value : ''
    }
}
