import type { PodEntity } from '@/domain/entities/workloads'
import { KubeWorkloadCatalog } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'

export class WorkloadPodSelector {
    public static labelSelectorFor(kind: KubeResourceKind, object: Record<string, unknown>): string {
        const spec = WorkloadPodSelector.asRecord(object.spec)
        const selector = WorkloadPodSelector.asRecord(spec?.selector)
        const matchLabels = WorkloadPodSelector.asRecord(selector?.matchLabels)

        if (matchLabels) {
            const pairs = Object.entries(matchLabels)
                .filter(([key, value]) => key !== '' && typeof value === 'string')
                .map(([key, value]) => `${key}=${value as string}`)

            if (pairs.length > 0) {
                return pairs.join(',')
            }
        }

        if (kind.registryKey === KubeWorkloadCatalog.jobsKey) {
            const metadata = WorkloadPodSelector.asRecord(object.metadata)
            const name = metadata?.name
            if (typeof name === 'string' && name !== '') {
                return `job-name=${name}`
            }
        }

        return ''
    }

    public static sortPods(pods: readonly PodEntity[]): PodEntity[] {
        return [...pods].sort((left, right) => {
            const runningOrder = WorkloadPodSelector.runningRank(left) - WorkloadPodSelector.runningRank(right)
            if (runningOrder !== 0) {
                return runningOrder
            }

            const timeOrder = WorkloadPodSelector.timestampOf(right.createdAt) - WorkloadPodSelector.timestampOf(left.createdAt)
            if (timeOrder !== 0) {
                return timeOrder
            }

            return left.name.localeCompare(right.name)
        })
    }

    private static runningRank(pod: PodEntity): number {
        return pod.phase === 'Running' ? 0 : 1
    }

    private static timestampOf(value: string): number {
        if (value === '') {
            return Number.NEGATIVE_INFINITY
        }

        const parsed = Date.parse(value)
        return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
    }

    private static asRecord(value: unknown): Record<string, unknown> | null {
        return typeof value === 'object' && value !== null && !Array.isArray(value)
            ? value as Record<string, unknown>
            : null
    }
}
