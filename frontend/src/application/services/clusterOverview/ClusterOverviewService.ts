import { inject, injectable } from 'tsyringe'
import type { RepoEntityBase } from '@iappx/entity-repo'
import { ResourceListService } from '@/application/services/resourceList/ResourceListService'
import { ClusterOverviewLimits } from '@/application/services/clusterOverview/constants/ClusterOverviewLimits'
import type { TClusterEvent } from '@/application/services/clusterOverview/types/TClusterEvent'
import type { TClusterOverview } from '@/application/services/clusterOverview/types/TClusterOverview'
import type { TClusterOverviewRequest } from '@/application/services/clusterOverview/types/TClusterOverviewRequest'
import type { TKindFetchResult } from '@/application/services/clusterOverview/types/TKindFetchResult'
import type { TNodeHealth } from '@/application/services/clusterOverview/types/TNodeHealth'
import type { TNodeIssue } from '@/application/services/clusterOverview/types/TNodeIssue'
import type { TWorkloadSummary } from '@/application/services/clusterOverview/types/TWorkloadSummary'
import { EventEntity, NodeEntity } from '@/domain/entities/cluster'
import { KubeObjectHealth, KubeObjectKey } from '@/domain/entities/kube'
import { CronJobEntity, JobEntity, PodEntity } from '@/domain/entities/workloads'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeResourceKind, KubeWorkloadCatalog } from '@/domain/models/kube'
import { WorkloadEfficiencyAnalyzer } from '@/domain/models/metrics'

@injectable()
export class ClusterOverviewService {
    public static readonly nodesKey: string = KubeResourceKind.registryKeyOf('', 'nodes')

    public static readonly eventsKey: string = KubeResourceKind.registryKeyOf('', 'events')

    public static readonly warningSelector: string = 'type=Warning'

    constructor(
        @inject(ResourceListService) private readonly listService: ResourceListService,
    ) {}

    public async load(request: TClusterOverviewRequest): Promise<TClusterOverview> {
        const kinds = request.kinds
            .filter(kind => KubeWorkloadCatalog.isOverviewSummarised(kind))
            .sort((a, b) => KubeWorkloadCatalog.overviewOrder(a) - KubeWorkloadCatalog.overviewOrder(b))

        const [fetched, events] = await Promise.all([
            Promise.all(kinds.map(kind => this.fetchKind(request, kind))),
            this.events(request),
        ])

        const nodeResult = fetched.find(entry => entry.registryKey === ClusterOverviewService.nodesKey)
        const podResult = fetched.find(entry => entry.registryKey === KubeWorkloadCatalog.podsKey)
        const nodeEntities = (nodeResult?.items ?? []).filter((item): item is NodeEntity => item instanceof NodeEntity)
        const podEntities = (podResult?.items ?? []).filter((item): item is PodEntity => item instanceof PodEntity)

        return {
            workloads: fetched.map(entry => entry.summary),
            nodes: ClusterOverviewService.nodeHealthOf(nodeEntities, nodeResult?.error ?? ''),
            events: events.items,
            eventsError: events.error,
            capacity: WorkloadEfficiencyAnalyzer.summarizeCapacity(nodeEntities, podEntities),
            pods: podEntities,
        }
    }

    private async fetchKind(request: TClusterOverviewRequest, kind: KubeResourceKind): Promise<TKindFetchResult> {
        const base: TWorkloadSummary = {
            kindKey: kind.key,
            title: kind.title,
            icon: kind.icon,
            slug: kind.slug,
            section: kind.section,
            total: 0,
            healthy: 0,
            problems: 0,
            warnings: 0,
            errors: 0,
            error: '',
        }

        const isNodes = kind.registryKey === ClusterOverviewService.nodesKey

        try {
            const result = await this.listService.list({
                clusterId: request.clusterId,
                kind,
                namespaces: kind.namespaced ? request.namespaces : undefined,
                limit: isNodes ? ClusterOverviewLimits.nodePageSize : ClusterOverviewLimits.workloadPageSize,
            })

            return {
                registryKey: kind.registryKey,
                summary: ClusterOverviewService.summariseItems(base, kind, result.items, result.total),
                items: result.items,
                error: '',
            }
        } catch (err) {
            const error = ClusterOverviewService.messageOf(err)

            return {
                registryKey: kind.registryKey,
                summary: { ...base, error },
                items: [],
                error,
            }
        }
    }

    private async events(request: TClusterOverviewRequest): Promise<{ items: TClusterEvent[], error: string }> {
        const kind = ClusterOverviewService.kindOf(request, ClusterOverviewService.eventsKey)
        if (!kind) {
            return { items: [], error: '' }
        }

        try {
            const result = await this.listService.list({
                clusterId: request.clusterId,
                kind,
                namespaces: request.namespaces,
                fieldSelector: ClusterOverviewService.warningSelector,
                limit: ClusterOverviewLimits.eventPageSize,
            })

            return { items: ClusterOverviewService.newest(result.items), error: '' }
        } catch (err) {
            return { items: [], error: ClusterOverviewService.messageOf(err) }
        }
    }

    private static summariseItems(
        base: TWorkloadSummary,
        kind: KubeResourceKind,
        items: readonly RepoEntityBase[],
        reportedTotal: number | undefined,
    ): TWorkloadSummary {
        const total = reportedTotal ?? items.length
        let ok = 0
        let warnings = 0
        let errors = 0

        for (const item of items) {
            if (!KubeObjectHealth.hasState(item)) {
                ok += 1
                continue
            }
            const state = KubeObjectHealth.stateOf(item)
            if (state === 'ok') {
                ok += 1
            } else if (state === 'warning') {
                warnings += 1
            } else if (state === 'error') {
                errors += 1
            }
        }

        const problems = warnings + errors
        const unloaded = Math.max(0, total - items.length)
        const healthy = Math.min(total - problems, ok + unloaded)
        const note = ClusterOverviewService.noteOf(kind, items)

        return {
            ...base,
            total,
            healthy,
            problems,
            warnings,
            errors,
            ...(note ? { note } : {}),
        }
    }

    private static noteOf(kind: KubeResourceKind, items: readonly RepoEntityBase[]): string | undefined {
        if (kind.registryKey === KubeWorkloadCatalog.podsKey) {
            const completed = items.filter((item): item is PodEntity => item instanceof PodEntity && item.phase === 'Succeeded').length
            return completed > 0 ? `${completed} completed` : undefined
        }
        if (kind.registryKey === KubeWorkloadCatalog.jobsKey) {
            const complete = items.filter((item): item is JobEntity => item instanceof JobEntity && item.isComplete).length
            return complete > 0 ? `${complete} complete` : undefined
        }
        if (kind.registryKey === KubeWorkloadCatalog.cronJobsKey) {
            const paused = items.filter((item): item is CronJobEntity => item instanceof CronJobEntity && item.isSuspended).length
            return paused > 0 ? `${paused} paused` : undefined
        }

        return undefined
    }

    private static nodeHealthOf(nodes: readonly NodeEntity[], error: string): TNodeHealth {
        if (error) {
            return { total: 0, ready: 0, issues: [], error }
        }

        return {
            total: nodes.length,
            ready: nodes.filter(node => node.isReady).length,
            issues: nodes.filter(node => KubeObjectHealth.isProblematic(node)).map(node => ClusterOverviewService.issueOf(node)),
            error: '',
        }
    }

    // The API server cannot order a list, so the newest are picked out of the page it served.
    private static newest(items: readonly RepoEntityBase[]): TClusterEvent[] {
        return items
            .filter((item): item is EventEntity => item instanceof EventEntity)
            .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
            .slice(0, ClusterOverviewLimits.eventsShown)
            .map(event => ({
                key: KubeObjectKey.of(event),
                reason: event.reason ?? '',
                message: event.message ?? '',
                object: event.involvedObjectText,
                namespace: event.namespace,
                lastSeen: event.lastSeen,
                count: event.count ?? 1,
                state: KubeObjectHealth.stateOf(event),
            }))
    }

    private static issueOf(node: NodeEntity): TNodeIssue {
        const reasons: string[] = []
        if (!node.isReady) {
            reasons.push('Not ready')
        }
        if (node.isCordoned) {
            reasons.push('Cordoned')
        }
        node.pressures.forEach(pressure => reasons.push(pressure))

        return {
            name: node.name,
            state: KubeObjectHealth.stateOf(node),
            detail: reasons.length > 0 ? reasons.join(', ') : 'Reported an unknown condition',
        }
    }

    private static kindOf(request: TClusterOverviewRequest, registryKey: string): KubeResourceKind | undefined {
        return request.kinds.find(kind => kind.registryKey === registryKey)
    }

    private static messageOf(err: unknown): string {
        return err instanceof ApiError ? err.message : 'This part of the cluster could not be read'
    }
}
