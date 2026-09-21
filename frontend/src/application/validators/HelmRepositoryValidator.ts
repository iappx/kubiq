import { injectable } from 'tsyringe'
import type { THelmRepositoryDraft } from '@/domain/entities/helm/types/THelmRepositoryDraft'
import type { TValidationResult } from '@/lib/validation/types/TValidationResult'

@injectable()
export class HelmRepositoryValidator {
    private static readonly namePattern: RegExp = /^[a-zA-Z0-9]([-_.a-zA-Z0-9]*[a-zA-Z0-9])?$/

    public validate(draft: THelmRepositoryDraft): TValidationResult {
        const errors: Record<string, string> = {}
        const name = draft.name.trim()
        const url = draft.url.trim()

        if (name.length === 0) {
            errors.name = 'Give the repository a name'
        } else if (!HelmRepositoryValidator.namePattern.test(name)) {
            errors.name = 'Use letters, digits, dashes, dots and underscores only'
        }

        const urlError = HelmRepositoryValidator.urlError(url)
        if (urlError !== '') {
            errors.url = urlError
        }

        return { valid: Object.keys(errors).length === 0, errors }
    }

    private static urlError(url: string): string {
        if (url.length === 0) {
            return 'Enter the repository address'
        }

        let parsed: URL
        try {
            parsed = new URL(url)
        } catch {
            return 'That is not a valid address — expected something like https://charts.example.com'
        }

        return ['http:', 'https:', 'oci:'].includes(parsed.protocol)
            ? ''
            : 'A chart repository is reached over http, https or oci'
    }
}
