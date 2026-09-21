import type { TKubeLabels } from '@/domain/entities/kube/types/TKubeLabels'
import type { TKubeLabelSelectorRequirement } from '@/domain/entities/kube/types/TKubeLabelSelectorRequirement'

export type TKubeLabelSelector = {
    matchLabels?: TKubeLabels
    matchExpressions?: TKubeLabelSelectorRequirement[]
}
