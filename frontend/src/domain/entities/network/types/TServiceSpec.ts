import type { TKubeLabels } from '@/domain/entities/kube/types/TKubeLabels'
import type { TServicePort } from '@/domain/entities/network/types/TServicePort'
import type { TServiceType } from '@/domain/entities/network/types/TServiceType'

export type TServiceSpec = {
    type?: TServiceType
    clusterIP?: string
    clusterIPs?: string[]
    externalIPs?: string[]
    externalName?: string
    sessionAffinity?: string
    ports?: TServicePort[]
    selector?: TKubeLabels
}
