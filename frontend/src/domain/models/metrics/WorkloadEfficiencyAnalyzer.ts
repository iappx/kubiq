import type { NodeEntity } from '@/domain/entities/cluster'
import { MetricsObjectKey } from '@/domain/entities/metrics'
import type { PodEntity, TKubeContainer } from '@/domain/entities/workloads'
import { MetricQuantity } from '@/domain/models/metrics/MetricQuantity'
import type { TClusterCapacitySummary } from '@/domain/models/metrics/types/TClusterCapacitySummary'
import type { TEfficiencyItem } from '@/domain/models/metrics/types/TEfficiencyItem'
import type { TEfficiencyMode } from '@/domain/models/metrics/types/TEfficiencyMode'
import type { TEfficiencyNamespaceGroup } from '@/domain/models/metrics/types/TEfficiencyNamespaceGroup'
import type { TPodUsage } from '@/domain/models/metrics/types/TPodUsage'

export class WorkloadEfficiencyAnalyzer {
    private static readonly thresholds: Record<TEfficiencyMode, readonly number[]> = {
        'near-limit': [75, 80, 85, 90],
        'over-request': [125, 150, 175, 200],
        'unused-requests': [10, 25, 50],
    }

    private static readonly defaults: Record<TEfficiencyMode, number> = {
        'near-limit': 80,
        'over-request': 150,
        'unused-requests': 25,
    }

    public static emptyCapacity(): TClusterCapacitySummary {
        return {
            nodeCount: 0,
            cpuCapacityCores: 0,
            memoryCapacityBytes: 0,
            cpuAllocatableCores: 0,
            memoryAllocatableBytes: 0,
            podsAllocatable: 0,
            cpuRequestedCores: 0,
            memoryRequestedBytes: 0,
            podsAllocated: 0,
        }
    }

    public static thresholdsOf(mode: TEfficiencyMode): readonly number[] {
        return WorkloadEfficiencyAnalyzer.thresholds[mode]
    }

    public static defaultThreshold(mode: TEfficiencyMode): number {
        return WorkloadEfficiencyAnalyzer.defaults[mode]
    }

    public static summarizeCapacity(nodes: readonly NodeEntity[], pods: readonly PodEntity[]): TClusterCapacitySummary {
        let cpuCapacityCores = 0
        let memoryCapacityBytes = 0
        let cpuAllocatableCores = 0
        let memoryAllocatableBytes = 0
        let podsAllocatable = 0

        for (const node of nodes) {
            cpuCapacityCores += MetricQuantity.parse(node.status?.capacity?.cpu)
            memoryCapacityBytes += MetricQuantity.parse(node.status?.capacity?.memory)
            cpuAllocatableCores += MetricQuantity.parse(node.status?.allocatable?.cpu)
            memoryAllocatableBytes += MetricQuantity.parse(node.status?.allocatable?.memory)
            podsAllocatable += MetricQuantity.parse(node.status?.allocatable?.pods)
        }

        let cpuRequestedCores = 0
        let memoryRequestedBytes = 0
        let podsAllocated = 0

        for (const pod of pods) {
            if (pod.phase === 'Succeeded' || pod.phase === 'Failed') {
                continue
            }
            podsAllocated += 1
            cpuRequestedCores += WorkloadEfficiencyAnalyzer.podRequest(pod, 'cpu')
            memoryRequestedBytes += WorkloadEfficiencyAnalyzer.podRequest(pod, 'memory')
        }

        return {
            nodeCount: nodes.length,
            cpuCapacityCores,
            memoryCapacityBytes,
            cpuAllocatableCores,
            memoryAllocatableBytes,
            podsAllocatable,
            cpuRequestedCores,
            memoryRequestedBytes,
            podsAllocated,
        }
    }

    public static analyze(
        pods: readonly PodEntity[],
        podUsage: Record<string, TPodUsage>,
        mode: TEfficiencyMode,
        thresholdPercent: number,
    ): TEfficiencyNamespaceGroup[] {
        const byNamespace = new Map<string, TEfficiencyItem[]>()

        for (const pod of pods) {
            if (pod.phase !== 'Running') {
                continue
            }
            const usage = podUsage[MetricsObjectKey.of(pod.namespace, pod.name)]
            if (!usage) {
                continue
            }
            const candidates = WorkloadEfficiencyAnalyzer.evaluatePod(pod, usage, mode, thresholdPercent)
            if (candidates.length === 0) {
                continue
            }
            const existing = byNamespace.get(pod.namespace) ?? []
            existing.push(...candidates)
            byNamespace.set(pod.namespace, existing)
        }

        return [...byNamespace.entries()]
            .map(([namespace, items]) => WorkloadEfficiencyAnalyzer.toGroup(namespace, items, mode))
            .sort((a, b) => WorkloadEfficiencyAnalyzer.compareGroups(a, b, mode))
    }

    private static evaluatePod(
        pod: PodEntity,
        usage: TPodUsage,
        mode: TEfficiencyMode,
        thresholdPercent: number,
    ): TEfficiencyItem[] {
        const containers = pod.spec?.containers ?? []
        if (containers.length === 0) {
            return []
        }

        if (usage.containers && Object.keys(usage.containers).length > 0) {
            const matched: TEfficiencyItem[] = []
            for (const container of containers) {
                const containerUsage = usage.containers[container.name]
                if (!containerUsage) {
                    continue
                }
                const item = WorkloadEfficiencyAnalyzer.buildItem(
                    pod,
                    container.name,
                    containerUsage.cpuCores,
                    containerUsage.memoryBytes,
                    MetricQuantity.parse(container.resources?.requests?.cpu),
                    MetricQuantity.parse(container.resources?.limits?.cpu),
                    MetricQuantity.parse(container.resources?.requests?.memory),
                    MetricQuantity.parse(container.resources?.limits?.memory),
                    mode,
                    thresholdPercent,
                )
                if (item) {
                    matched.push(item)
                }
            }
            return matched
        }

        const containerName = containers.length === 1 ? containers[0].name : ''
        const cpuRequestCores = WorkloadEfficiencyAnalyzer.sumContainers(containers, c => c.resources?.requests?.cpu)
        const cpuLimitCores = WorkloadEfficiencyAnalyzer.sumContainers(containers, c => c.resources?.limits?.cpu)
        const memoryRequestBytes = WorkloadEfficiencyAnalyzer.sumContainers(containers, c => c.resources?.requests?.memory)
        const memoryLimitBytes = WorkloadEfficiencyAnalyzer.sumContainers(containers, c => c.resources?.limits?.memory)

        const item = WorkloadEfficiencyAnalyzer.buildItem(
            pod,
            containerName,
            usage.cpuCores,
            usage.memoryBytes,
            cpuRequestCores,
            cpuLimitCores,
            memoryRequestBytes,
            memoryLimitBytes,
            mode,
            thresholdPercent,
        )

        return item ? [item] : []
    }

    private static buildItem(
        pod: PodEntity,
        containerName: string,
        cpuUsedCores: number,
        memoryUsedBytes: number,
        cpuRequestCores: number,
        cpuLimitCores: number,
        memoryRequestBytes: number,
        memoryLimitBytes: number,
        mode: TEfficiencyMode,
        thresholdPercent: number,
    ): TEfficiencyItem | null {
        const cpuBase = mode === 'near-limit' ? cpuLimitCores : cpuRequestCores
        const memoryBase = mode === 'near-limit' ? memoryLimitBytes : memoryRequestBytes
        const cpuRatio = MetricQuantity.ratio(cpuUsedCores, cpuBase)
        const memoryRatio = MetricQuantity.ratio(memoryUsedBytes, memoryBase)

        if (!WorkloadEfficiencyAnalyzer.matches(mode, thresholdPercent, cpuBase, cpuRatio, memoryBase, memoryRatio)) {
            return null
        }

        const suffix = containerName ? `/${containerName}` : ''

        return {
            key: `${pod.namespace}/${pod.name}${suffix}`,
            namespace: pod.namespace,
            podName: pod.name,
            containerName,
            cpuUsedCores,
            cpuRequestCores,
            cpuLimitCores,
            cpuRatio,
            memoryUsedBytes,
            memoryRequestBytes,
            memoryLimitBytes,
            memoryRatio,
        }
    }

    private static matches(
        mode: TEfficiencyMode,
        thresholdPercent: number,
        cpuBase: number,
        cpuRatio: number,
        memoryBase: number,
        memoryRatio: number,
    ): boolean {
        if (mode === 'unused-requests') {
            const cpuLow = cpuBase > 0 && cpuRatio * 100 <= thresholdPercent
            const memLow = memoryBase > 0 && memoryRatio * 100 <= thresholdPercent
            return cpuLow || memLow
        }

        const cpuHigh = cpuBase > 0 && cpuRatio * 100 >= thresholdPercent
        const memHigh = memoryBase > 0 && memoryRatio * 100 >= thresholdPercent
        return cpuHigh || memHigh
    }

    private static toGroup(namespace: string, items: TEfficiencyItem[], mode: TEfficiencyMode): TEfficiencyNamespaceGroup {
        const sorted = [...items].sort((a, b) => WorkloadEfficiencyAnalyzer.compareItems(a, b, mode))
        const uniquePods = new Set(sorted.map(item => item.podName))

        let maxCpuRatio = 0
        let maxMemoryRatio = 0
        let totalCpuUsedCores = 0
        let totalMemoryUsedBytes = 0

        for (const item of sorted) {
            if (item.cpuRatio > maxCpuRatio) {
                maxCpuRatio = item.cpuRatio
            }
            if (item.memoryRatio > maxMemoryRatio) {
                maxMemoryRatio = item.memoryRatio
            }
            totalCpuUsedCores += item.cpuUsedCores
            totalMemoryUsedBytes += item.memoryUsedBytes
        }

        return {
            namespace,
            items: sorted,
            podCount: uniquePods.size,
            maxCpuRatio,
            maxMemoryRatio,
            totalCpuUsedCores,
            totalMemoryUsedBytes,
        }
    }

    private static compareItems(left: TEfficiencyItem, right: TEfficiencyItem, mode: TEfficiencyMode): number {
        const diff = mode === 'unused-requests'
            ? WorkloadEfficiencyAnalyzer.compareNumbers(
                WorkloadEfficiencyAnalyzer.unusedRatio(left),
                WorkloadEfficiencyAnalyzer.unusedRatio(right),
            )
            : WorkloadEfficiencyAnalyzer.compareNumbers(
                Math.max(right.cpuRatio, right.memoryRatio),
                Math.max(left.cpuRatio, left.memoryRatio),
            )
        if (diff !== 0) {
            return diff
        }
        const byPod = left.podName.localeCompare(right.podName)
        return byPod !== 0 ? byPod : left.containerName.localeCompare(right.containerName)
    }

    private static compareGroups(
        left: TEfficiencyNamespaceGroup,
        right: TEfficiencyNamespaceGroup,
        mode: TEfficiencyMode,
    ): number {
        const diff = mode === 'unused-requests'
            ? WorkloadEfficiencyAnalyzer.compareNumbers(
                WorkloadEfficiencyAnalyzer.groupUnusedRatio(left),
                WorkloadEfficiencyAnalyzer.groupUnusedRatio(right),
            )
            : WorkloadEfficiencyAnalyzer.compareNumbers(
                Math.max(right.maxCpuRatio, right.maxMemoryRatio),
                Math.max(left.maxCpuRatio, left.maxMemoryRatio),
            )
        return diff !== 0 ? diff : left.namespace.localeCompare(right.namespace)
    }

    private static unusedRatio(item: TEfficiencyItem): number {
        const ratios: number[] = []
        if (item.cpuRequestCores > 0) {
            ratios.push(item.cpuRatio)
        }
        if (item.memoryRequestBytes > 0) {
            ratios.push(item.memoryRatio)
        }

        return ratios.length > 0 ? Math.min(...ratios) : Number.POSITIVE_INFINITY
    }

    private static groupUnusedRatio(group: TEfficiencyNamespaceGroup): number {
        return group.items.length > 0
            ? WorkloadEfficiencyAnalyzer.unusedRatio(group.items[0])
            : Number.POSITIVE_INFINITY
    }

    private static compareNumbers(left: number, right: number): number {
        if (left === right) {
            return 0
        }

        return left < right ? -1 : 1
    }

    private static podRequest(pod: PodEntity, resource: 'cpu' | 'memory'): number {
        const regular = WorkloadEfficiencyAnalyzer.sumContainers(
            pod.spec?.containers ?? [],
            c => c.resources?.requests?.[resource],
        )
        const initValues = (pod.spec?.initContainers ?? []).map(
            c => MetricQuantity.parse(c.resources?.requests?.[resource]),
        )
        const maxInit = initValues.length > 0 ? Math.max(...initValues) : 0

        return Math.max(regular, maxInit)
    }

    private static sumContainers(
        containers: readonly TKubeContainer[],
        pick: (container: TKubeContainer) => string | undefined,
    ): number {
        return MetricQuantity.sum(containers.map(pick))
    }
}
