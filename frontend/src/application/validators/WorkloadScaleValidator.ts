import { injectable } from 'tsyringe'
import type { TWorkloadScaleDraft } from '@/application/services/workloadAction/types/TWorkloadScaleDraft'
import type { TValidationResult } from '@/lib/validation/types/TValidationResult'

@injectable()
export class WorkloadScaleValidator {
    private static readonly whole: RegExp = /^\d+$/

    public validate(draft: TWorkloadScaleDraft): TValidationResult {
        const errors: Record<string, string> = {}
        const replicas = draft.replicas.trim()

        if (replicas.length === 0) {
            errors.replicas = 'Enter how many replicas to run'
        } else if (!WorkloadScaleValidator.whole.test(replicas)) {
            errors.replicas = 'A replica count is a whole number, and it cannot be negative'
        }

        return { valid: Object.keys(errors).length === 0, errors }
    }

    public static parse(draft: TWorkloadScaleDraft): number {
        return Number.parseInt(draft.replicas.trim(), 10)
    }
}
