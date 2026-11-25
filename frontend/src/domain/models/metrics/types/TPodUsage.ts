export type TPodUsage = {
    cpuCores: number
    memoryBytes: number
    containers?: Record<string, { cpuCores: number; memoryBytes: number }>
}
