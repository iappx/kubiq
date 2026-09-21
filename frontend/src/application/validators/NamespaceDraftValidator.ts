import { injectable } from 'tsyringe'
import { NamespaceNameRules } from '@/domain/entities/cluster/NamespaceNameRules'
import type { TNamespaceDraft } from '@/domain/entities/cluster/types/TNamespaceDraft'
import type { TValidationResult } from '@/lib/validation/types/TValidationResult'

@injectable()
export class NamespaceDraftValidator {
    public validate(draft: TNamespaceDraft): TValidationResult {
        const errors: Record<string, string> = {}
        const name = NamespaceDraftValidator.parse(draft)

        if (name.length === 0) {
            errors.name = 'Enter a name for the namespace'
        } else if (name.length > NamespaceNameRules.maxLength) {
            errors.name = `A namespace name is at most ${NamespaceNameRules.maxLength} characters`
        } else if (!NamespaceNameRules.isValid(name)) {
            errors.name = 'Use lowercase letters, digits and hyphens, starting and ending with a letter or digit'
        } else if (NamespaceNameRules.isReserved(name)) {
            errors.name = `Names starting with ${NamespaceNameRules.reservedPrefix} are reserved for Kubernetes itself`
        }

        return { valid: Object.keys(errors).length === 0, errors }
    }

    public static parse(draft: TNamespaceDraft): string {
        return draft.name.trim()
    }
}
