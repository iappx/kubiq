import type { TKubeObjectRef } from '@/domain/entities/kube/types/TKubeObjectRef'

export type TEndpointAddress = {
    ip?: string
    hostname?: string
    nodeName?: string
    targetRef?: TKubeObjectRef
}
