import type { TYamlApplyPlan } from '@/application/services/resourceYaml/types/TYamlApplyPlan'

export type TYamlApplyResult = {
    plan: TYamlApplyPlan
    object: Record<string, unknown>
}
