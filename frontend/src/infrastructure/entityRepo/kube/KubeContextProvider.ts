import { inject, singleton } from 'tsyringe'
import { EntityRepo } from '@iappx/entity-repo'
import { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import { KubeStreamTransport } from '@/infrastructure/entityRepo/kube/transport/KubeStreamTransport'
import { KubeTransport } from '@/infrastructure/entityRepo/kube/transport/KubeTransport'
import type { TKubeClusterConnection } from '@/infrastructure/entityRepo/kube/types/TKubeClusterConnection'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

@singleton()
export class KubeContextProvider {
    private readonly connections = new Map<string, TKubeClusterConnection>()

    constructor(
        @inject(WailsRuntimeService) private readonly runtime: WailsRuntimeService,
    ) {}

    public context(clusterId: string, sessionId: string): KubeEntityContext {
        return this.connection(clusterId, sessionId).context
    }

    public stream(clusterId: string, sessionId: string): KubeStreamTransport {
        return this.connection(clusterId, sessionId).stream
    }

    public request(clusterId: string, sessionId: string): KubeTransport {
        return this.connection(clusterId, sessionId).transport
    }

    public has(clusterId: string): boolean {
        return this.connections.has(clusterId)
    }

    public release(clusterId: string): void {
        this.connections.delete(clusterId)
    }

    public releaseAll(): void {
        this.connections.clear()
    }

    protected connection(clusterId: string, sessionId: string): TKubeClusterConnection {
        const known = this.connections.get(clusterId)
        // A reconnect gives the same cluster a new session, and the old one addresses
        // a session the Go side has already forgotten.
        if (known && known.sessionId === sessionId) {
            return known
        }

        const created = this.build(sessionId)
        this.connections.set(clusterId, created)

        return created
    }

    protected build(sessionId: string): TKubeClusterConnection {
        const transport = new KubeTransport(sessionId, this.runtime)

        return {
            sessionId,
            // getContext() builds a new context on every call, so it is built once here.
            context: EntityRepo.create()
                .use(KubeEntityContext, transport)
                .getContext(KubeEntityContext),
            transport,
            stream: new KubeStreamTransport(sessionId, this.runtime),
        }
    }
}
