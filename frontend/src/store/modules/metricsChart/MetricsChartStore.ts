import { inject } from 'tsyringe'
import { PrometheusService } from '@/application/services/prometheus/PrometheusService'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { MetricRangeCatalog } from '@/domain/models/metrics'
import type { TMetricRangeId } from '@/domain/models/metrics'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { InjectableStore, StoreBase } from '@/lib/vue-store'
import { MetricsChartKey } from '@/store/modules/metricsChart/MetricsChartKey'
import { MetricsChartStateFactory } from '@/store/modules/metricsChart/MetricsChartStateFactory'
import type { TMetricsChartRequest } from '@/store/modules/metricsChart/types/TMetricsChartRequest'
import type { TMetricsChartState } from '@/store/modules/metricsChart/types/TMetricsChartState'
import type { TPrometheusTargetState } from '@/store/modules/metricsChart/types/TPrometheusTargetState'

@InjectableStore
export class MetricsChartStore extends StoreBase<MetricsChartStore> {
    public range: TMetricRangeId = MetricRangeCatalog.Default

    public targets: Record<string, TPrometheusTargetState> = {}

    public charts: Record<string, TMetricsChartState> = {}

    constructor(
        @inject(PrometheusService) private readonly prometheusService: PrometheusService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public targetOf(clusterId: string): TPrometheusTargetState {
        return this.targets[clusterId] ?? MetricsChartStateFactory.target()
    }

    public chartOf(request: TMetricsChartRequest): TMetricsChartState {
        return this.charts[this.keyOf(request)] ?? MetricsChartStateFactory.chart()
    }

    public setRange(range: TMetricRangeId): void {
        this.range = MetricRangeCatalog.parse(range)
    }

    public resolveOnce(clusterId: string): Promise<void> {
        const known = this.targets[clusterId]

        return known && (known.loaded || known.loading) ? Promise.resolve() : this.resolve(clusterId)
    }

    public async resolve(clusterId: string): Promise<void> {
        if (clusterId === '' || this.targetOf(clusterId).loading) {
            return
        }

        this.patchTarget(clusterId, { loading: true })
        try {
            const resolution = await this.prometheusService.resolve(clusterId)
            this.patchTarget(clusterId, { ...resolution, loaded: true })
        } catch (err) {
            this.patchTarget(clusterId, { state: 'missing', target: null, loaded: true })
            this.eventBus.emitEvent(new AppErrorEvent(err, 'MetricsChartStore.resolve'))
        } finally {
            this.patchTarget(clusterId, { loading: false })
        }
    }

    public async load(request: TMetricsChartRequest): Promise<void> {
        const target = this.targetOf(request.clusterId)
        const key = this.keyOf(request)
        if (!target.target || target.state !== 'ready') {
            this.patchChart(key, { series: [], loaded: true, error: '', errorDetail: '' })
            return
        }

        this.patchChart(key, { loading: true, error: '', errorDetail: '' })
        try {
            const series = await this.prometheusService.series({
                clusterId: request.clusterId,
                target: target.target,
                layout: target.layout,
                kind: request.kind,
                scope: request.scope,
                range: MetricRangeCatalog.resolve(this.range, Date.now()),
            })
            this.patchChart(key, { series, loaded: true })
        } catch (err) {
            this.patchChart(key, {
                series: [],
                loaded: true,
                error: err instanceof ApiError ? err.message : 'Prometheus did not answer the query',
                errorDetail: err instanceof ApiError ? (err.details ?? '') : String(err),
            })
            this.eventBus.emitEvent(new AppErrorEvent(err, 'MetricsChartStore.load'))
        } finally {
            this.patchChart(key, { loading: false })
        }
    }

    public forget(clusterId: string): void {
        if (clusterId in this.targets) {
            const remaining = { ...this.targets }
            delete remaining[clusterId]
            this.targets = remaining
        }

        const charts: Record<string, TMetricsChartState> = {}
        Object.keys(this.charts).forEach((key) => {
            if (!MetricsChartKey.belongsTo(key, clusterId)) {
                charts[key] = this.charts[key]
            }
        })
        this.charts = charts
    }

    private keyOf(request: TMetricsChartRequest): string {
        return MetricsChartKey.of(request.clusterId, request.scope, request.kind, this.range)
    }

    private patchTarget(clusterId: string, changes: Partial<TPrometheusTargetState>): void {
        const current = this.targets[clusterId] ?? MetricsChartStateFactory.target()

        this.targets = { ...this.targets, [clusterId]: { ...current, ...changes } }
    }

    private patchChart(key: string, changes: Partial<TMetricsChartState>): void {
        const current = this.charts[key] ?? MetricsChartStateFactory.chart()

        this.charts = { ...this.charts, [key]: { ...current, ...changes } }
    }
}
