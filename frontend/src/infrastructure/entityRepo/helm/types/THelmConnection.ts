import type { HelmEntityContext } from '@/infrastructure/entityRepo/helm/HelmEntityContext'
import type { HelmStreamTransport } from '@/infrastructure/entityRepo/helm/transport/HelmStreamTransport'
import type { HelmTransport } from '@/infrastructure/entityRepo/helm/transport/HelmTransport'

export type THelmConnection = {
    fingerprint: string
    context: HelmEntityContext
    transport: HelmTransport
    stream: HelmStreamTransport
}
