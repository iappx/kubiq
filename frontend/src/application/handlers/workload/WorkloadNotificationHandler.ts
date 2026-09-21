import { inject, singleton } from 'tsyringe'
import { ToastService } from '@/application/services/toast/ToastService'
import { CronJobTriggeredEvent } from '@/domain/events/cluster/CronJobTriggeredEvent'
import { ResourceDeletedEvent } from '@/domain/events/cluster/ResourceDeletedEvent'
import { WorkloadRestartedEvent } from '@/domain/events/cluster/WorkloadRestartedEvent'
import { WorkloadScaledEvent } from '@/domain/events/cluster/WorkloadScaledEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'

@singleton()
export class WorkloadNotificationHandler {
    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(ToastService) private readonly toastService: ToastService,
    ) {
        this.eventBus.registerHandler(WorkloadScaledEvent, e => this.toastService.success(
            `Scaled ${e.kindName} ${WorkloadNotificationHandler.objectOf(e.name, e.namespace)} to ${e.replicas} ${e.replicas === 1 ? 'replica' : 'replicas'}`,
        ))

        this.eventBus.registerHandler(WorkloadRestartedEvent, e => this.toastService.success(
            `Restarted the rollout of ${e.kindName} ${WorkloadNotificationHandler.objectOf(e.name, e.namespace)}`,
            'Pods are replaced by the controller as the new template rolls out',
        ))

        this.eventBus.registerHandler(CronJobTriggeredEvent, e => this.toastService.success(
            `Triggered CronJob ${WorkloadNotificationHandler.objectOf(e.name, e.namespace)}`,
            e.jobName === '' ? undefined : `Created job ${e.jobName}`,
        ))

        this.eventBus.registerHandler(ResourceDeletedEvent, e => this.toastService.success(
            `Deleted ${e.kindName} ${WorkloadNotificationHandler.objectOf(e.name, e.namespace)}`,
        ))
    }

    private static objectOf(name: string, namespace: string): string {
        return namespace === '' ? name : `${namespace}/${name}`
    }
}
