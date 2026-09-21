import type { TTerminalContainer, TTerminalHint, TTerminalKind, TTerminalState } from '@/domain/models/terminal'

export type TTerminalView = {
    key: string
    clusterId: string
    kind: TTerminalKind
    title: string
    namespace: string
    podName: string
    containerName: string
    containers: TTerminalContainer[]
    nodeName: string
    state: TTerminalState
    failure: string
    hint: TTerminalHint
}
