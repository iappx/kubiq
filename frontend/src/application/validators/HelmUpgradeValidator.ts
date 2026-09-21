import { injectable } from 'tsyringe'
import { HelmValuesDocument } from '@/application/services/helm/models/HelmValuesDocument'
import type { THelmUpgradeDraft } from '@/domain/entities/helm/types/THelmUpgradeDraft'
import type { TValidationResult } from '@/lib/validation/types/TValidationResult'

@injectable()
export class HelmUpgradeValidator {
    public validate(draft: THelmUpgradeDraft): TValidationResult {
        const errors: Record<string, string> = {}
        const chart = draft.chart.trim()

        if (draft.releaseName.trim().length === 0) {
            errors.releaseName = 'The release to upgrade is unknown'
        }

        if (chart.length === 0) {
            errors.chart = 'Name the chart to upgrade to, for example bitnami/nginx'
        } else if (/\s/.test(chart)) {
            errors.chart = 'A chart reference carries no spaces'
        }

        if (/\s/.test(draft.version.trim())) {
            errors.version = 'A chart version carries no spaces'
        }

        const valuesError = HelmValuesDocument.error(draft.values)
        if (valuesError !== '') {
            errors.values = valuesError
        }

        return { valid: Object.keys(errors).length === 0, errors }
    }
}
