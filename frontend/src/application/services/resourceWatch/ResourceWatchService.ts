import { inject, singleton } from 'tsyringe'
import { ResourceListService } from '@/application/services/resourceList/ResourceListService'
import { ResourceWatchSession } from '@/application/services/resourceWatch/models/ResourceWatchSession'
import type { TResourceWatchHandlers } from '@/application/services/resourceWatch/types/TResourceWatchHandlers'
import type { TResourceWatchRequest } from '@/application/services/resourceWatch/types/TResourceWatchRequest'
import type { KubeResourceKind } from '@/domain/models/kube'

@singleton()
export class ResourceWatchService {
    private readonly sessions = new Map<string, ResourceWatchSession>()

    constructor(
        @inject(ResourceListService) private readonly listService: ResourceListService,
    ) {}

    public static keyOf(clusterId: string, kind: KubeResourceKind, scope: string = ''): string {
        const session = `${clusterId}|${kind.key}`

        return scope === '' ? session : `${session}|${scope}`
    }

    public isWatching(clusterId: string, kind: KubeResourceKind, scope: string = ''): boolean {
        return this.sessions.has(ResourceWatchService.keyOf(clusterId, kind, scope))
    }

    public async start(request: TResourceWatchRequest, handlers: TResourceWatchHandlers): Promise<void> {
        const key = ResourceWatchService.keyOf(request.clusterId, request.kind, request.scope)
        await this.stopAt(key)

        const session = new ResourceWatchSession(this.listService, request, handlers)
        this.sessions.set(key, session)

        try {
            await session.start()
        } catch (err) {
            this.sessions.delete(key)
            throw err
        }
    }

    public stop(clusterId: string, kind: KubeResourceKind, scope: string = ''): Promise<void> {
        return this.stopAt(ResourceWatchService.keyOf(clusterId, kind, scope))
    }

    public async release(clusterId: string): Promise<void> {
        const prefix = `${clusterId}|`
        const keys = [...this.sessions.keys()].filter(key => key.startsWith(prefix))

        await Promise.allSettled(keys.map(key => this.stopAt(key)))
    }

    private async stopAt(key: string): Promise<void> {
        const session = this.sessions.get(key)
        if (!session) {
            return
        }

        this.sessions.delete(key)
        await session.stop()
    }
}
