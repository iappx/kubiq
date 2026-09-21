import { injectable } from 'tsyringe'
import type { TKubeconfigSourceDraft } from '@/domain/entities/catalog/types/TKubeconfigSourceDraft'
import type { TValidationResult } from '@/lib/validation/types/TValidationResult'

@injectable()
export class KubeconfigSourceValidator {
    private static readonly looksLikeYaml: RegExp = /\.(ya?ml|conf|config)$/i

    public validate(draft: TKubeconfigSourceDraft): TValidationResult {
        const errors: Record<string, string> = {}
        const path = draft.path.trim()

        if (path.length === 0) {
            errors.path = 'Enter the path to a kubeconfig file'
        } else if (path.endsWith('/') || path.endsWith('\\')) {
            errors.path = 'That is a folder — name the kubeconfig file inside it'
        } else if (KubeconfigSourceValidator.hasExtension(path) && !KubeconfigSourceValidator.looksLikeYaml.test(path)) {
            errors.path = 'A kubeconfig is a YAML file — expected .yaml, .yml, .conf or no extension'
        }

        return { valid: Object.keys(errors).length === 0, errors }
    }

    private static hasExtension(path: string): boolean {
        const separator = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
        const name = path.slice(separator + 1)

        return name.lastIndexOf('.') > 0
    }
}
