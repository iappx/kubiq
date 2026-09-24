import { injectable } from 'tsyringe'
import { PastedKubeconfig } from '@/application/services/kubeconfigImport/models/PastedKubeconfig'
import type { TKubeconfigSourceDraft } from '@/domain/entities/catalog/types/TKubeconfigSourceDraft'
import type { TValidationResult } from '@/lib/validation/types/TValidationResult'

@injectable()
export class KubeconfigSourceValidator {
    public validate(draft: TKubeconfigSourceDraft): TValidationResult {
        const errors = draft.mode === 'paste'
            ? KubeconfigSourceValidator.checkText(draft.text)
            : KubeconfigSourceValidator.checkPath(draft.path)

        return { valid: Object.keys(errors).length === 0, errors }
    }

    private static checkPath(value: string): Record<string, string> {
        return value.trim().length === 0 ? { path: 'Enter the path to a kubeconfig file or folder' } : {}
    }

    private static checkText(value: string): Record<string, string> {
        const problem = PastedKubeconfig.problemWith(value)

        return problem === '' ? {} : { text: problem }
    }
}
