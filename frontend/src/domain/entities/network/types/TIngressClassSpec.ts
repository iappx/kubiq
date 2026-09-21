import type { TKubeObjectRef } from '@/domain/entities/kube/types/TKubeObjectRef'

export type TIngressClassSpec = {
    controller?: string
    parameters?: TKubeObjectRef
}
