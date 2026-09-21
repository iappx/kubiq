import type { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import type { KubeStreamTransport } from '@/infrastructure/entityRepo/kube/transport/KubeStreamTransport'
import type { KubeTransport } from '@/infrastructure/entityRepo/kube/transport/KubeTransport'
import type { MetricsEntityContext } from '@/infrastructure/entityRepo/metrics/MetricsEntityContext'
import type { PrometheusEntityContext } from '@/infrastructure/entityRepo/metrics/PrometheusEntityContext'

export type TKubeClusterConnection = {
    sessionId: string
    context: KubeEntityContext
    metrics: MetricsEntityContext
    prometheus: PrometheusEntityContext
    transport: KubeTransport
    stream: KubeStreamTransport
}
