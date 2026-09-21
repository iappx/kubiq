import type { TLoadBalancerIngress } from '@/domain/entities/network/types/TLoadBalancerIngress'

export type TLoadBalancerStatus = {
    loadBalancer?: {
        ingress?: TLoadBalancerIngress[]
    }
}
