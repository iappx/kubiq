import { inject, singleton } from 'tsyringe'
import { EntityRepo } from '@iappx/entity-repo'
import type { THelmEnvironment } from '@/domain/models/helm/types/THelmEnvironment'
import { HelmEntityContext } from '@/infrastructure/entityRepo/helm/HelmEntityContext'
import { HelmStreamTransport } from '@/infrastructure/entityRepo/helm/transport/HelmStreamTransport'
import { HelmTransport } from '@/infrastructure/entityRepo/helm/transport/HelmTransport'
import type { THelmConnection } from '@/infrastructure/entityRepo/helm/types/THelmConnection'
import { ProcessAdapter } from '@/infrastructure/process/ProcessAdapter'

@singleton()
export class HelmContextProvider {
    private readonly connections = new Map<string, THelmConnection>()

    constructor(
        @inject(ProcessAdapter) private readonly processes: ProcessAdapter,
    ) {}

    public context(clusterId: string, environment: THelmEnvironment): HelmEntityContext {
        return this.connection(clusterId, environment).context
    }

    public stream(clusterId: string, environment: THelmEnvironment): HelmStreamTransport {
        return this.connection(clusterId, environment).stream
    }

    public release(clusterId: string): void {
        this.connections.delete(clusterId)
    }

    public releaseAll(): void {
        this.connections.clear()
    }

    protected connection(clusterId: string, environment: THelmEnvironment): THelmConnection {
        const fingerprint = HelmContextProvider.fingerprintOf(environment)
        const known = this.connections.get(clusterId)
        // A changed executable path or kubeconfig list must not keep answering through
        // a context bound to the previous one.
        if (known && known.fingerprint === fingerprint) {
            return known
        }

        const built = this.build(environment, fingerprint)
        this.connections.set(clusterId, built)

        return built
    }

    protected build(environment: THelmEnvironment, fingerprint: string): THelmConnection {
        const transport = new HelmTransport(environment, this.processes)

        return {
            fingerprint,
            // getContext() builds a new context on every call, so it is built once here.
            context: EntityRepo.create()
                .use(HelmEntityContext, transport)
                .getContext(HelmEntityContext),
            transport,
            stream: new HelmStreamTransport(environment, this.processes),
        }
    }

    protected static fingerprintOf(environment: THelmEnvironment): string {
        return JSON.stringify([environment.executable, environment.contextName, environment.kubeconfig])
    }
}
