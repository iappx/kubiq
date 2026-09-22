import { injectable } from 'tsyringe'
import { PastedKubeconfig } from '@/application/services/kubeconfigImport/models/PastedKubeconfig'
import type { TKubeconfigSourceDraft } from '@/domain/entities/catalog/types/TKubeconfigSourceDraft'
import type { TValidationResult } from '@/lib/validation/types/TValidationResult'

@injectable()
export class KubeconfigSourceValidator {
    private static readonly looksLikeYaml: RegExp = /\.(ya?ml|conf|config)$/i

    public validate(draft: TKubeconfigSourceDraft): TValidationResult {
        const errors = draft.mode === 'paste'
            ? KubeconfigSourceValidator.checkText(draft.text)
            : KubeconfigSourceValidator.checkPath(draft.path)

        return { valid: Object.keys(errors).length === 0, errors }
    }

    private static checkPath(value: string): Record<string, string> {
        const path = value.trim()

        if (path.length === 0) {
            return { path: 'Enter the path to a kubeconfig file' }
        }
        if (path.endsWith('/') || path.endsWith('\\')) {
            return { path: 'That is a folder — name the kubeconfig file inside it' }
        }
        if (KubeconfigSourceValidator.hasExtension(path) && !KubeconfigSourceValidator.looksLikeYaml.test(path)) {
            return { path: 'A kubeconfig is a YAML file — expected .yaml, .yml, .conf or no extension' }
        }

        return {}
    }

    private static checkText(value: string): Record<string, string> {
        const problem = PastedKubeconfig.problemWith(value)

        return problem === '' ? {} : { text: problem }
    }

    private static hasExtension(path: string): boolean {
        const separator = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
        const name = path.slice(separator + 1)

        return name.lastIndexOf('.') > 0
    }
}
