import { injectable } from 'tsyringe'
import { PrometheusSourceCatalog } from '@/domain/entities/settings/PrometheusSourceCatalog'
import type { TClusterSettingsDraft } from '@/domain/entities/settings/types/TClusterSettingsDraft'
import { PrometheusLayoutCatalog } from '@/domain/models/metrics'
import type { TValidationResult } from '@/lib/validation/types/TValidationResult'

@injectable()
export class ClusterSettingsValidator {
    private static readonly service: RegExp = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?\/[a-z0-9]([-a-z0-9]*[a-z0-9])?:([a-z0-9-]+)$/

    public validate(draft: TClusterSettingsDraft): TValidationResult {
        const errors: Record<string, string> = {}

        if (draft.clusterId.trim().length === 0) {
            errors.clusterId = 'Choose the cluster these settings belong to'
        }

        if (!PrometheusSourceCatalog.has(draft.prometheusSource)) {
            errors.prometheusSource = 'Choose where kubiq should reach Prometheus'
        }

        if (!PrometheusLayoutCatalog.has(draft.prometheusLayout)) {
            errors.prometheusLayout = 'Choose how this Prometheus labels its Kubernetes series'
        }

        const urlError = draft.prometheusSource === 'url'
            ? ClusterSettingsValidator.urlError(draft.prometheusUrl.trim())
            : ''

        if (urlError) {
            errors.prometheusUrl = urlError
        }

        if (draft.prometheusSource === 'service' && !ClusterSettingsValidator.service.test(draft.prometheusService.trim())) {
            errors.prometheusService = 'Name the service as namespace/name:port, for example monitoring/prometheus:9090'
        }

        return { valid: Object.keys(errors).length === 0, errors }
    }

    private static urlError(url: string): string {
        if (url.length === 0) {
            return 'Enter the address of the Prometheus HTTP API'
        }

        let parsed: URL
        try {
            parsed = new URL(url)
        } catch {
            return 'That is not a valid address — expected something like http://prometheus.internal:9090'
        }

        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
            ? ''
            : 'Prometheus is reached over http or https'
    }
}
