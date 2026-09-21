import { injectable } from 'tsyringe'
import { HelmValuesDocument } from '@/application/services/helm/models/HelmValuesDocument'
import type { THelmInstallDraft } from '@/domain/entities/helm/types/THelmInstallDraft'
import type { TValidationResult } from '@/lib/validation/types/TValidationResult'

@injectable()
export class HelmInstallValidator {
    public static readonly maxReleaseName: number = 53

    private static readonly releaseName: RegExp = /^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/

    private static readonly namespace: RegExp = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/

    public validate(draft: THelmInstallDraft): TValidationResult {
        const errors: Record<string, string> = {}
        const releaseName = draft.releaseName.trim()
        const namespace = draft.namespace.trim()
        const chart = draft.chart.trim()

        if (releaseName.length === 0) {
            errors.releaseName = 'Name the release'
        } else if (releaseName.length > HelmInstallValidator.maxReleaseName) {
            errors.releaseName = `A release name is at most ${HelmInstallValidator.maxReleaseName} characters`
        } else if (!HelmInstallValidator.releaseName.test(releaseName)) {
            errors.releaseName = 'Use lowercase letters, digits, dashes and dots, starting and ending with a letter or a digit'
        }

        if (namespace.length === 0) {
            errors.namespace = 'Choose the namespace to install into'
        } else if (!HelmInstallValidator.namespace.test(namespace)) {
            errors.namespace = 'Use lowercase letters, digits and dashes'
        }

        if (chart.length === 0) {
            errors.chart = 'Name the chart, for example bitnami/nginx'
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
