import { inject, singleton } from 'tsyringe'
import { ToastService } from '@/application/services/toast/ToastService'
import { HelmReleaseInstalledEvent } from '@/domain/events/helm/HelmReleaseInstalledEvent'
import { HelmReleaseRolledBackEvent } from '@/domain/events/helm/HelmReleaseRolledBackEvent'
import { HelmReleaseUninstalledEvent } from '@/domain/events/helm/HelmReleaseUninstalledEvent'
import { HelmReleaseUpgradedEvent } from '@/domain/events/helm/HelmReleaseUpgradedEvent'
import { HelmRepositoriesChangedEvent } from '@/domain/events/helm/HelmRepositoriesChangedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'

@singleton()
export class HelmNotificationHandler {
    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(ToastService) private readonly toastService: ToastService,
    ) {
        this.eventBus.registerHandler(HelmReleaseInstalledEvent, e => this.toastService.success(
            `Installed ${HelmNotificationHandler.objectOf(e.releaseName, e.namespace)}`,
            e.chart,
        ))

        this.eventBus.registerHandler(HelmReleaseUpgradedEvent, e => this.toastService.success(
            `Upgraded ${HelmNotificationHandler.objectOf(e.releaseName, e.namespace)}`,
            e.chart,
        ))

        this.eventBus.registerHandler(HelmReleaseUninstalledEvent, e => this.toastService.success(
            `Uninstalled ${HelmNotificationHandler.objectOf(e.releaseName, e.namespace)}`,
        ))

        this.eventBus.registerHandler(HelmReleaseRolledBackEvent, e => this.toastService.success(
            `Rolled ${HelmNotificationHandler.objectOf(e.releaseName, e.namespace)} back`,
            `Revision ${e.revision}`,
        ))

        this.eventBus.registerHandler(HelmRepositoriesChangedEvent, e => this.toastService.success(e.message))
    }

    private static objectOf(name: string, namespace: string): string {
        return namespace === '' ? name : `${namespace}/${name}`
    }
}
