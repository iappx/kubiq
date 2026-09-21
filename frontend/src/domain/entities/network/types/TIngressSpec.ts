import type { TIngressRule } from '@/domain/entities/network/types/TIngressRule'
import type { TIngressTls } from '@/domain/entities/network/types/TIngressTls'

export type TIngressSpec = {
    ingressClassName?: string
    rules?: TIngressRule[]
    tls?: TIngressTls[]
}
