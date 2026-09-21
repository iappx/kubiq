import type { TKubeColumn } from '@/domain/models/kube/types/TKubeColumn'
import type { TKubeSection } from '@/domain/models/kube/types/TKubeSection'
import type { TKubeVerb } from '@/domain/models/kube/types/TKubeVerb'

export type TKubeResourceKindDefinition = {
    group: string
    version: string
    resource: string
    kind: string
    title: string
    namespaced: boolean
    section: TKubeSection
    icon: string
    columns: TKubeColumn[]
    verbs: TKubeVerb[]
    isCustom?: boolean
}
