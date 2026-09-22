import { injectable } from 'tsyringe'
import type { TArgoSyncDraft } from '@/domain/entities/argocd/types/TArgoSyncDraft'
import type { TValidationResult } from '@/lib/validation/types/TValidationResult'

@injectable()
export class ArgoSyncValidator {
    public static readonly maxRevisionLength: number = 255

    private static readonly spaced: RegExp = /\s/

    public validate(draft: TArgoSyncDraft): TValidationResult {
        const errors: Record<string, string> = {}
        const revision = draft.revision.trim()

        if (ArgoSyncValidator.spaced.test(revision)) {
            errors.revision = 'A revision is a branch, a tag or a commit — it carries no spaces'
        } else if (revision.length > ArgoSyncValidator.maxRevisionLength) {
            errors.revision = `A revision is at most ${ArgoSyncValidator.maxRevisionLength} characters`
        }

        if (draft.replace && draft.applyOutOfSyncOnly) {
            errors.replace = 'Replace recreates every object, so it cannot be limited to the out-of-sync ones'
        }

        return { valid: Object.keys(errors).length === 0, errors }
    }
}
