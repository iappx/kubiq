import { injectable } from 'tsyringe'
import type { TResourceDataEditDraft } from '@/application/services/resourceData/types/TResourceDataEditDraft'
import type { TValidationResult } from '@/lib/validation/types/TValidationResult'

@injectable()
export class ResourceDataKeyValidator {
    private static readonly keyPattern: RegExp = /^[-._a-zA-Z0-9]+$/

    public validate(draft: TResourceDataEditDraft, existingKeys: readonly string[]): TValidationResult {
        const errors: Record<string, string> = {}

        if (draft.key.trim().length === 0) {
            errors.key = 'Key is required'
        } else if (!ResourceDataKeyValidator.keyPattern.test(draft.key)) {
            errors.key = "Key may contain only letters, digits, '-', '_' and '.'"
        } else if (draft.key !== draft.originalKey && existingKeys.includes(draft.key)) {
            errors.key = `Key "${draft.key}" already exists`
        }

        return { valid: Object.keys(errors).length === 0, errors }
    }
}
