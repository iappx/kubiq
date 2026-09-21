import type { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import type { KubeStreamTransport } from '@/infrastructure/entityRepo/kube/transport/KubeStreamTransport'

export type TKubeClusterConnection = {
    sessionId: string
    context: KubeEntityContext
    stream: KubeStreamTransport
}
