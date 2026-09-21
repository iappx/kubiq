import { inject, injectable } from 'tsyringe'
import type { RepoEntityBase } from '@iappx/entity-repo'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { ResourceListService } from '@/application/services/resourceList/ResourceListService'
import { SettingsService } from '@/application/services/settings/SettingsService'
import type { TMetricSeriesRequest } from '@/application/services/prometheus/types/TMetricSeriesRequest'
import type { TPrometheusResolution } from '@/application/services/prometheus/types/TPrometheusResolution'
import type { TPrometheusSearch } from '@/application/services/prometheus/types/TPrometheusSearch'
import { ServiceEntity } from '@/domain/entities/network'
import type { TClusterSettingsDraft } from '@/domain/entities/settings'
import { KubeResourceRegistry } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'
import {
    MetricLevelCatalog,
    PromQueryCatalog,
    PrometheusLayoutCatalog,
    PrometheusPresetCatalog,
    PrometheusTargetAddress,
} from '@/domain/models/metrics'
import type {
    TMetricSeries,
    TMetricsState,
    TPrometheusLayoutId,
    TPrometheusPreset,
    TPrometheusTarget,
} from '@/domain/models/metrics'
import { KubeContextProvider } from '@/infrastructure/entityRepo/kube/KubeContextProvider'
import { KubeStatusReader } from '@/infrastructure/entityRepo/kube/transport/KubeStatusReader'
import { PrometheusApiParams } from '@/infrastructure/entityRepo/metrics/PrometheusApiParams'
import { PrometheusQueryMeta } from '@/infrastructure/entityRepo/metrics/PrometheusQueryMeta'
import type { PrometheusEntityContext } from '@/infrastructure/entityRepo/metrics/PrometheusEntityContext'

@injectable()
export class PrometheusService {
    constructor(
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
        @inject(ResourceListService) private readonly listService: ResourceListService,
        @inject(SettingsService) private readonly settingsService: SettingsService,
        @inject(KubeContextProvider) private readonly contexts: KubeContextProvider,
    ) {}

    // A cluster with no saved row has never been decided about, so it is discovered
    // rather than treated as switched off.
    public async resolve(clusterId: string): Promise<TPrometheusResolution> {
        const settings = await this.settingsService.clusterSettings(clusterId)
        if (!settings || settings.prometheusSource === 'auto') {
            return this.discover(clusterId)
        }
        if (settings.prometheusSource === 'none') {
            return PrometheusService.unresolved('off', settings.prometheusLayout)
        }
        if (settings.prometheusSource === 'url') {
            return PrometheusService.unresolved('unsupported', settings.prometheusLayout)
        }

        return this.configured(clusterId, settings)
    }

    public async series(request: TMetricSeriesRequest): Promise<TMetricSeries[]> {
        if (!MetricLevelCatalog.isAddressable(request.scope)) {
            return []
        }

        const context = this.context(request.clusterId)
        if (!context) {
            return []
        }

        const rows = await context.range
            .withMeta(PrometheusQueryMeta.forTarget(request.target))
            .withQueryParams({
                [PrometheusApiParams.query]: PromQueryCatalog.of(request.layout, request.kind, request.scope),
                [PrometheusApiParams.start]: request.range.from,
                [PrometheusApiParams.end]: request.range.to,
                [PrometheusApiParams.step]: `${request.range.stepSeconds}s`,
            })
            .getAll()

        const grouping = PromQueryCatalog.groupLabelOf(request.layout, request.scope)
        const fallback = MetricLevelCatalog.subjectOf(request.scope)

        return rows
            .map(row => ({
                key: row.key,
                label: (grouping === '' ? '' : row.labelOf(grouping)) || fallback,
                points: row.points,
            }))
            .filter(series => series.points.length > 0)
    }

    private async configured(clusterId: string, settings: TClusterSettingsDraft): Promise<TPrometheusResolution> {
        const target = PrometheusTargetAddress.parse(settings.prometheusService)
        if (!target) {
            return PrometheusService.unresolved('missing', settings.prometheusLayout)
        }

        const state = await this.probe(clusterId, target)
        const layout = PrometheusLayoutCatalog.of(settings.prometheusLayout)

        return { state, target: state === 'ready' ? target : null, layout, discovered: false }
    }

    private async discover(clusterId: string): Promise<TPrometheusResolution> {
        const kind = PrometheusService.servicesKind()
        if (!kind) {
            return PrometheusService.unresolved('missing')
        }

        let refused = false

        for (const preset of PrometheusPresetCatalog.all()) {
            const search = await this.match(clusterId, kind, preset)
            if (search.target) {
                return {
                    state: 'ready',
                    target: search.target,
                    layout: PrometheusLayoutCatalog.of(preset.id),
                    discovered: true,
                }
            }
            refused = refused || search.refused
        }

        // Every preset asks the same question, so a user who cannot list Services never
        // finds Prometheus — saying it is absent would send them hunting for a chart instead.
        return PrometheusService.unresolved(refused ? 'forbidden' : 'missing')
    }

    private async match(
        clusterId: string,
        kind: KubeResourceKind,
        preset: TPrometheusPreset,
    ): Promise<TPrometheusSearch> {
        let found: RepoEntityBase[]
        try {
            const result = await this.listService.list({
                clusterId,
                kind,
                namespaces: [],
                labelSelector: preset.labelSelector,
            })
            found = result.items
        } catch (err) {
            return { target: null, refused: KubeStatusReader.isForbidden(err) }
        }

        const service = found.find((item): item is ServiceEntity => item instanceof ServiceEntity && item.name !== '')
        if (!service) {
            return { target: null, refused: false }
        }

        const port = PrometheusPresetCatalog.portOf(preset, service.ports)

        return {
            target: port === '' ? null : { namespace: service.namespace, service: service.name, port },
            refused: false,
        }
    }

    // A hand-typed address may point at anything, so it is asked one cheap question
    // before the panel starts charting against it.
    private async probe(clusterId: string, target: TPrometheusTarget): Promise<TMetricsState> {
        const context = this.context(clusterId)
        if (!context) {
            return 'missing'
        }

        try {
            await context.instant
                .withMeta(PrometheusQueryMeta.forTarget(target))
                .withQueryParams({ [PrometheusApiParams.query]: PromQueryCatalog.probe() })
                .getAll()

            return 'ready'
        } catch (err) {
            return PrometheusService.stateOf(err)
        }
    }

    private context(clusterId: string): PrometheusEntityContext | null {
        const connection = this.connectionService.connection(clusterId)

        return connection ? this.contexts.prometheus(clusterId, connection.sessionId) : null
    }

    private static stateOf(err: unknown): TMetricsState {
        if (KubeStatusReader.isForbidden(err)) {
            return 'forbidden'
        }

        return KubeStatusReader.isAbsent(err) ? 'missing' : 'unsupported'
    }

    private static servicesKind(): KubeResourceKind | null {
        return KubeResourceRegistry.find('', 'services') ?? null
    }

    private static unresolved(state: TMetricsState, layout?: TPrometheusLayoutId): TPrometheusResolution {
        return { state, target: null, layout: PrometheusLayoutCatalog.of(layout), discovered: false }
    }
}
