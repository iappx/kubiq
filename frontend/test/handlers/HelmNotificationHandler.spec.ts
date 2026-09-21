import { beforeEach, describe, expect, it } from 'vitest'
import { container } from 'tsyringe'
import { HelmNotificationHandler } from '@/application/handlers/helm/HelmNotificationHandler'
import { HelmReleaseInstalledEvent } from '@/domain/events/helm/HelmReleaseInstalledEvent'
import { HelmReleaseRolledBackEvent } from '@/domain/events/helm/HelmReleaseRolledBackEvent'
import { HelmReleaseUninstalledEvent } from '@/domain/events/helm/HelmReleaseUninstalledEvent'
import { HelmReleaseUpgradedEvent } from '@/domain/events/helm/HelmReleaseUpgradedEvent'
import { HelmRepositoriesChangedEvent } from '@/domain/events/helm/HelmRepositoriesChangedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ToastStore } from '@/store/modules/toast/ToastStore'

container.resolve(HelmNotificationHandler)
const eventBus = container.resolve(EventBus)
const toastStore = container.resolve(ToastStore)

describe('HelmNotificationHandler', () => {
    beforeEach(() => {
        toastStore.items = []
    })

    it('names the release and its namespace after an install', () => {
        eventBus.emitEvent(new HelmReleaseInstalledEvent('staging', 'dev', 'web', 'bitnami/nginx'))

        expect(toastStore.items[0].message).toBe('Installed dev/web')
        expect(toastStore.items[0].description).toBe('bitnami/nginx')
        expect(toastStore.items[0].type).toBe('success')
    })

    it('says what happened for an upgrade, an uninstall and a rollback', () => {
        eventBus.emitEvent(new HelmReleaseUpgradedEvent('staging', 'dev', 'web', 'bitnami/nginx'))
        eventBus.emitEvent(new HelmReleaseUninstalledEvent('staging', 'dev', 'web'))
        eventBus.emitEvent(new HelmReleaseRolledBackEvent('staging', 'dev', 'web', 3))

        expect(toastStore.items.map(toast => toast.message)).toEqual([
            'Upgraded dev/web',
            'Uninstalled dev/web',
            'Rolled dev/web back',
        ])
        expect(toastStore.items[2].description).toBe('Revision 3')
    })

    it('passes on what the repository change was', () => {
        eventBus.emitEvent(new HelmRepositoriesChangedEvent('staging', 'Chart repositories updated'))

        expect(toastStore.items[0].message).toBe('Chart repositories updated')
    })
})
