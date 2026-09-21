import type { TPodLogContainer, TPodLogOptions, TPodLogState } from '@/domain/models/kube'

export type TPodLogView = {
    key: string
    clusterId: string
    namespace: string
    podName: string
    containers: TPodLogContainer[]
    options: TPodLogOptions
    state: TPodLogState
    failure: string
    // The viewport repaints off this counter, not off the line buffer.
    revision: number
    lineCount: number
    dropped: number
    search: string
    onlyMatches: boolean
    showContainer: boolean
    wrap: boolean
    autoscroll: boolean
}
