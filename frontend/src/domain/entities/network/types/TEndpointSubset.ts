import type { TEndpointAddress } from '@/domain/entities/network/types/TEndpointAddress'
import type { TEndpointPort } from '@/domain/entities/network/types/TEndpointPort'

export type TEndpointSubset = {
    addresses?: TEndpointAddress[]
    notReadyAddresses?: TEndpointAddress[]
    ports?: TEndpointPort[]
}
