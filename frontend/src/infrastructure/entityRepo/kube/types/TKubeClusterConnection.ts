import type { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import type { KubeStreamTransport } from '@/infrastructure/entityRepo/kube/transport/KubeStreamTransport'
import type { KubeTransport } from '@/infrastructure/entityRepo/kube/transport/KubeTransport'

export type TKubeClusterConnection = {
    sessionId: string
    context: KubeEntityContext
    transport: KubeTransport
    stream: KubeStreamTransport
}
