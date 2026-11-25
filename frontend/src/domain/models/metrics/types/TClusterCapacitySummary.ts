export type TClusterCapacitySummary = {
    nodeCount: number
    cpuCapacityCores: number
    memoryCapacityBytes: number
    cpuAllocatableCores: number
    memoryAllocatableBytes: number
    podsAllocatable: number
    cpuRequestedCores: number
    memoryRequestedBytes: number
    podsAllocated: number
}
