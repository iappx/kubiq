import { inject } from 'tsyringe'
import { CustomResourceService } from '@/application/services/customResource/CustomResourceService'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import type { KubeResourceKind } from '@/domain/models/kube'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { InjectableStore, StoreBase } from '@/lib/vue-store'

@InjectableStore
export class CustomResourceKindStore extends StoreBase<CustomResourceKindStore> {
    public refined: Record<string, KubeResourceKind> = {}

    public resolvedKeys: string[] = []

    constructor(
        @inject(CustomResourceService) private readonly customResourceService: CustomResourceService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public static keyOf(clusterId: string, kind: KubeResourceKind): string {
        return `${clusterId}|${kind.key}`
    }

    public kindOf(clusterId: string, kind: KubeResourceKind | null): KubeResourceKind | null {
        if (!kind) {
            return null
        }

        return this.refined[CustomResourceKindStore.keyOf(clusterId, kind)] ?? kind
    }

    public isResolved(clusterId: string, kind: KubeResourceKind): boolean {
        return this.resolvedKeys.includes(CustomResourceKindStore.keyOf(clusterId, kind))
    }

    public async resolve(clusterId: string, kind: KubeResourceKind | null): Promise<void> {
        if (!kind || !CustomResourceService.definesColumns(kind) || this.isResolved(clusterId, kind)) {
            return
        }

        const key = CustomResourceKindStore.keyOf(clusterId, kind)
        this.resolvedKeys = [...this.resolvedKeys, key]

        try {
            const refined = await this.customResourceService.printerColumns(clusterId, kind)
            if (refined) {
                this.refined = { ...this.refined, [key]: refined }
            }
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, 'CustomResourceKindStore.resolve'))
        }
    }

    public forget(clusterId: string): void {
        const prefix = `${clusterId}|`
        const remaining: Record<string, KubeResourceKind> = {}

        Object.keys(this.refined).forEach((key) => {
            if (!key.startsWith(prefix)) {
                remaining[key] = this.refined[key]
            }
        })

        this.refined = remaining
        this.resolvedKeys = this.resolvedKeys.filter(key => !key.startsWith(prefix))
    }
}
