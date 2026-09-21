import { PrometheusLayoutCatalog } from '@/domain/models/metrics'
import type { TMetricsChartState } from '@/store/modules/metricsChart/types/TMetricsChartState'
import type { TPrometheusTargetState } from '@/store/modules/metricsChart/types/TPrometheusTargetState'

export class MetricsChartStateFactory {
    public static chart(): TMetricsChartState {
        return { series: [], loading: false, loaded: false, error: '', errorDetail: '' }
    }

    public static target(): TPrometheusTargetState {
        return {
            state: 'missing',
            target: null,
            layout: PrometheusLayoutCatalog.of(undefined),
            discovered: false,
            loading: false,
            loaded: false,
        }
    }
}
