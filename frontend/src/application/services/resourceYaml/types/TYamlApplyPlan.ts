import type { TYamlApplyMode } from '@/application/services/resourceYaml/types/TYamlApplyMode'

export type TYamlApplyPlan = {
    mode: TYamlApplyMode
    fields: string[]
    unsupported: string[]
    ignored: string[]
}
