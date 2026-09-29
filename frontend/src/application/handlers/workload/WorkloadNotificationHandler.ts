import { inject, singleton } from 'tsyringe'
import { ToastService } from '@/application/services/toast/ToastService'
import { CronJobSuspendedEvent } from '@/domain/events/cluster/CronJobSuspendedEvent'
import { CronJobTriggeredEvent } from '@/domain/events/cluster/CronJobTriggeredEvent'
import { OpenClusterObjectEvent } from '@/domain/events/cluster/OpenClusterObjectEvent'
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

        this.eventBus.registerHandler(CronJobTriggeredEvent, e => this.announceTriggered(e))

        this.eventBus.registerHandler(CronJobSuspendedEvent, e => this.toastService.success(
            `${e.suspended ? 'Suspended' : 'Resumed'} CronJob ${WorkloadNotificationHandler.objectOf(e.name, e.namespace)}`,
            e.suspended ? 'No new jobs are scheduled until it is resumed' : 'Jobs are scheduled again from the next run',
        ))

        this.eventBus.registerHandler(ResourceDeletedEvent, e => this.toastService.success(
            `Deleted ${e.kindName} ${WorkloadNotificationHandler.objectOf(e.name, e.namespace)}`,
        ))
    }

    private announceTriggered(event: CronJobTriggeredEvent): void {
        const cronJob = `CronJob ${WorkloadNotificationHandler.objectOf(event.name, event.namespace)}`
        if (event.jobName === '') {
            this.toastService.success(`Triggered ${cronJob}`)
            return
        }

        this.toastService.show({
            type: 'success',
            message: `Job ${event.jobName} created`,
            description: `Triggered from ${cronJob}`,
            action: {
                label: 'View job',
                run: () => this.eventBus.emitEvent(
                    new OpenClusterObjectEvent(event.clusterId, event.jobKind, event.namespace, event.jobName),
                ),
            },
        })
    }

    private static objectOf(name: string, namespace: string): string {
        return namespace === '' ? name : `${namespace}/${name}`
    }
}
