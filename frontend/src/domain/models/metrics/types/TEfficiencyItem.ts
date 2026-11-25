export type TEfficiencyItem = {
    key: string
    namespace: string
    podName: string
    containerName: string
    cpuUsedCores: number
    cpuRequestCores: number
    cpuLimitCores: number
    cpuRatio: number
    memoryUsedBytes: number
    memoryRequestBytes: number
    memoryLimitBytes: number
    memoryRatio: number
}
