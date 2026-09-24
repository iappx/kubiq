import type { TDefaultClassPatch } from '@/application/services/defaultClass/types/TDefaultClassPatch'
import type { TDefaultClassTarget } from '@/application/services/defaultClass/types/TDefaultClassTarget'

export type TDefaultClassPlan = {
    target: TDefaultClassTarget
    isDefault: boolean
    cleared: string[]
    patches: TDefaultClassPatch[]
}
