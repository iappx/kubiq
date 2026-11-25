export type TPodDebugRequest = {
    clusterId: string
    namespace: string
    podName: string
    image: string
    targetContainerName?: string
}
