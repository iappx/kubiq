import type { PodEntity } from '@/domain/entities/workloads'
import { KubeWorkloadCatalog } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'

export class WorkloadPodSelector {
    public static labelSelectorFor(kind: KubeResourceKind, object: Record<string, unknown>): string {
        const spec = WorkloadPodSelector.asRecord(object.spec)
        const selector = WorkloadPodSelector.asRecord(spec?.selector)
        const clauses = [
            ...WorkloadPodSelector.matchLabelClauses(selector?.matchLabels),
            ...WorkloadPodSelector.matchExpressionClauses(selector?.matchExpressions),
        ]

        if (clauses.length > 0) {
            return clauses.join(',')
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

    private static matchLabelClauses(value: unknown): string[] {
        const matchLabels = WorkloadPodSelector.asRecord(value)
        if (!matchLabels) {
            return []
        }

        return Object.entries(matchLabels)
            .filter(([key, item]) => key !== '' && typeof item === 'string')
            .map(([key, item]) => `${key}=${item as string}`)
    }

    private static matchExpressionClauses(value: unknown): string[] {
        if (!Array.isArray(value)) {
            return []
        }

        const clauses: string[] = []
        for (const entry of value) {
            const clause = WorkloadPodSelector.expressionClause(entry)
            if (clause !== null) {
                clauses.push(clause)
            }
        }

        return clauses
    }

    private static expressionClause(entry: unknown): string | null {
        const item = WorkloadPodSelector.asRecord(entry)
        if (!item) {
            return null
        }

        const key = item.key
        const operator = item.operator
        if (typeof key !== 'string' || key === '' || typeof operator !== 'string') {
            return null
        }

        if (operator === 'Exists') {
            return key
        }
        if (operator === 'DoesNotExist') {
            return `!${key}`
        }
        if (operator === 'In' || operator === 'NotIn') {
            if (!Array.isArray(item.values)) {
                return null
            }

            const values = item.values.filter((val): val is string => typeof val === 'string' && val !== '')
            if (values.length === 0) {
                return null
            }

            const keyword = operator === 'In' ? 'in' : 'notin'
            return `${key} ${keyword} (${values.join(',')})`
        }

        return null
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
