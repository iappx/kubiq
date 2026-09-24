import { inject } from 'tsyringe'
import { DefaultClassService } from '@/application/services/defaultClass/DefaultClassService'
import type { TDefaultClassPlan } from '@/application/services/defaultClass/types/TDefaultClassPlan'
import type { TDefaultClassTarget } from '@/application/services/defaultClass/types/TDefaultClassTarget'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { DefaultClassChangedEvent } from '@/domain/events/cluster/DefaultClassChangedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { InjectableStore, StoreBase } from '@/lib/vue-store'

@InjectableStore
export class DefaultClassStore extends StoreBase<DefaultClassStore> {
    public actingKeys: string[] = []

    constructor(
        @inject(DefaultClassService) private readonly defaultClassService: DefaultClassService,
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public static keyOf(clusterId: string, rowKey: string): string {
        return `${clusterId}|${rowKey}`
    }

    public busyRowKeys(clusterId: string): string[] {
        const prefix = `${clusterId}|`

        return this.actingKeys
            .filter(key => key.startsWith(prefix))
            .map(key => key.slice(prefix.length))
    }

    public async prepare(target: TDefaultClassTarget, isDefault: boolean): Promise<TDefaultClassPlan | null> {
        let plan: TDefaultClassPlan | null = null

        await this.act(target, 'DefaultClassStore.prepare', async () => {
            plan = await this.defaultClassService.prepare(target, isDefault)
        })

        return plan
    }

    public apply(plan: TDefaultClassPlan): Promise<boolean> {
        return this.act(plan.target, 'DefaultClassStore.apply', async () => {
            await this.defaultClassService.apply(plan)
            this.eventBus.emitEvent(new DefaultClassChangedEvent(
                plan.target.clusterId,
                plan.target.kind.kind,
                plan.target.name,
                plan.isDefault,
                plan.cleared,
            ))
        })
    }

    private async act(target: TDefaultClassTarget, context: string, action: () => Promise<void>): Promise<boolean> {
        const key = DefaultClassStore.keyOf(target.clusterId, target.rowKey)
        this.actingKeys = [...this.actingKeys, key]

        try {
            await action()
            return true
        } catch (err) {
            this.eventBus.emitEvent(new AppErrorEvent(err, context))
            return false
        } finally {
            this.actingKeys = this.actingKeys.filter(open => open !== key)
        }
    }
}
