import { inject, injectable } from 'tsyringe'
import type { RepoEntityBase } from '@iappx/entity-repo'
import { ResourceListService } from '@/application/services/resourceList/ResourceListService'
import { ClusterOverviewLimits } from '@/application/services/clusterOverview/constants/ClusterOverviewLimits'
import type { TClusterEvent } from '@/application/services/clusterOverview/types/TClusterEvent'
import type { TClusterOverview } from '@/application/services/clusterOverview/types/TClusterOverview'
import type { TClusterOverviewRequest } from '@/application/services/clusterOverview/types/TClusterOverviewRequest'
import type { TNodeHealth } from '@/application/services/clusterOverview/types/TNodeHealth'
import type { TNodeIssue } from '@/application/services/clusterOverview/types/TNodeIssue'
import type { TWorkloadSummary } from '@/application/services/clusterOverview/types/TWorkloadSummary'
import { EventEntity, NodeEntity } from '@/domain/entities/cluster'
import { KubeObjectHealth, KubeObjectKey } from '@/domain/entities/kube'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeResourceKind, KubeWorkloadCatalog } from '@/domain/models/kube'

@injectable()
export class ClusterOverviewService {
    public static readonly nodesKey: string = KubeResourceKind.registryKeyOf('', 'nodes')

    public static readonly eventsKey: string = KubeResourceKind.registryKeyOf('', 'events')

    public static readonly warningSelector: string = 'type=Warning'

    constructor(
        @inject(ResourceListService) private readonly listService: ResourceListService,
    ) {}

    public async load(request: TClusterOverviewRequest): Promise<TClusterOverview> {
        const [workloads, nodes, events] = await Promise.all([
            this.workloads(request),
            this.nodes(request),
            this.events(request),
        ])

        return { workloads, nodes, events: events.items, eventsError: events.error }
    }

    private workloads(request: TClusterOverviewRequest): Promise<TWorkloadSummary[]> {
        const kinds = request.kinds
            .filter(kind => KubeWorkloadCatalog.isSummarised(kind))
            .sort((a, b) => KubeWorkloadCatalog.summaryOrder(a) - KubeWorkloadCatalog.summaryOrder(b))

        return Promise.all(kinds.map(kind => this.summarise(request, kind)))
    }

    private async summarise(request: TClusterOverviewRequest, kind: KubeResourceKind): Promise<TWorkloadSummary> {
        const summary: TWorkloadSummary = {
            kindKey: kind.key,
            title: kind.title,
            icon: kind.icon,
            slug: kind.slug,
            section: kind.section,
            total: 0,
            problems: 0,
            error: '',
        }

        try {
            const result = await this.listService.list({
                clusterId: request.clusterId,
                kind,
                namespaces: request.namespaces,
                limit: ClusterOverviewLimits.workloadPageSize,
            })

            return {
                ...summary,
                total: result.total ?? result.items.length,
                problems: KubeObjectHealth.countProblems(result.items),
            }
        } catch (err) {
            return { ...summary, error: ClusterOverviewService.messageOf(err) }
        }
    }

    private async nodes(request: TClusterOverviewRequest): Promise<TNodeHealth> {
        const kind = ClusterOverviewService.kindOf(request, ClusterOverviewService.nodesKey)
        if (!kind) {
            return { total: 0, ready: 0, issues: [], error: '' }
        }

        try {
            const result = await this.listService.list({
                clusterId: request.clusterId,
                kind,
                limit: ClusterOverviewLimits.nodePageSize,
            })

            const nodes = result.items.filter((item): item is NodeEntity => item instanceof NodeEntity)

            return {
                total: nodes.length,
                ready: nodes.filter(node => node.isReady).length,
                issues: nodes.filter(node => KubeObjectHealth.isProblematic(node)).map(node => ClusterOverviewService.issueOf(node)),
                error: '',
            }
        } catch (err) {
            return { total: 0, ready: 0, issues: [], error: ClusterOverviewService.messageOf(err) }
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
