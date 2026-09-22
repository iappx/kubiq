import { inject, singleton } from 'tsyringe'
import { ToastService } from '@/application/services/toast/ToastService'
import { ArgoApplicationDeletedEvent } from '@/domain/events/argocd/ArgoApplicationDeletedEvent'
import { ArgoAutoSyncChangedEvent } from '@/domain/events/argocd/ArgoAutoSyncChangedEvent'
import { ArgoRefreshRequestedEvent } from '@/domain/events/argocd/ArgoRefreshRequestedEvent'
import { ArgoSyncRequestedEvent } from '@/domain/events/argocd/ArgoSyncRequestedEvent'
import { ArgoSyncTerminatedEvent } from '@/domain/events/argocd/ArgoSyncTerminatedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'

@singleton()
export class ArgoNotificationHandler {
    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(ToastService) private readonly toastService: ToastService,
    ) {
        this.eventBus.registerHandler(ArgoSyncRequestedEvent, e => this.toastService.success(
            `${e.dryRun ? 'Dry run started for' : 'Sync started for'} ${ArgoNotificationHandler.objectOf(e.name, e.namespace)}`,
            ArgoNotificationHandler.revisionOf(e.revision),
        ))

        this.eventBus.registerHandler(ArgoRefreshRequestedEvent, e => this.toastService.success(
            `Refreshing ${ArgoNotificationHandler.objectOf(e.name, e.namespace)}`,
            e.hard ? 'Argo CD re-reads the manifests from the repository' : '',
        ))

        this.eventBus.registerHandler(ArgoSyncTerminatedEvent, e => this.toastService.success(
            `Asked Argo CD to stop the sync of ${ArgoNotificationHandler.objectOf(e.name, e.namespace)}`,
        ))

        this.eventBus.registerHandler(ArgoApplicationDeletedEvent, e => this.toastService.success(
            `Deleted application ${ArgoNotificationHandler.objectOf(e.name, e.namespace)}`,
            e.cascade ? 'The resources it deployed are deleted with it' : 'The resources it deployed are left in place',
        ))

        this.eventBus.registerHandler(ArgoAutoSyncChangedEvent, e => this.toastService.success(
            `${e.enabled ? 'Enabled' : 'Disabled'} automated sync for ${ArgoNotificationHandler.objectOf(e.name, e.namespace)}`,
        ))
    }

    private static objectOf(name: string, namespace: string): string {
        return namespace === '' ? name : `${namespace}/${name}`
    }

    private static revisionOf(revision: string): string {
        return revision === '' ? '' : `Revision ${revision}`
    }
}
