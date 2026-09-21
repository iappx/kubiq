export type TLeaseSpec = {
    holderIdentity?: string
    leaseDurationSeconds?: number
    acquireTime?: string
    renewTime?: string
    leaseTransitions?: number
}
