import { beforeEach, describe, expect, it } from 'vitest'
import { container } from 'tsyringe'
import { ArgoNotificationHandler } from '@/application/handlers/argocd/ArgoNotificationHandler'
import { ArgoApplicationDeletedEvent } from '@/domain/events/argocd/ArgoApplicationDeletedEvent'
import { ArgoAutoSyncChangedEvent } from '@/domain/events/argocd/ArgoAutoSyncChangedEvent'
import { ArgoRefreshRequestedEvent } from '@/domain/events/argocd/ArgoRefreshRequestedEvent'
import { ArgoSyncRequestedEvent } from '@/domain/events/argocd/ArgoSyncRequestedEvent'
import { ArgoSyncTerminatedEvent } from '@/domain/events/argocd/ArgoSyncTerminatedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ToastStore } from '@/store/modules/toast/ToastStore'

container.resolve(ArgoNotificationHandler)
const eventBus = container.resolve(EventBus)
const toastStore = container.resolve(ToastStore)

describe('ArgoNotificationHandler', () => {
    beforeEach(() => {
        toastStore.items = []
    })

    it('names the application and its namespace when a sync is asked for', () => {
        eventBus.emitEvent(new ArgoSyncRequestedEvent('prod', 'argocd', 'web', 'abc123', false))

        expect(toastStore.items[0].message).toBe('Sync started for argocd/web')
        expect(toastStore.items[0].description).toBe('Revision abc123')
        expect(toastStore.items[0].type).toBe('success')
    })

    it('says a dry run is a dry run, so nobody waits for a change', () => {
        eventBus.emitEvent(new ArgoSyncRequestedEvent('prod', 'argocd', 'web', '', true))

        expect(toastStore.items[0].message).toBe('Dry run started for argocd/web')
    })

    it('explains what a hard refresh does differently', () => {
        eventBus.emitEvent(new ArgoRefreshRequestedEvent('prod', 'argocd', 'web', true))

        expect(toastStore.items[0].message).toBe('Refreshing argocd/web')
        expect(toastStore.items[0].description).toBe('Argo CD re-reads the manifests from the repository')
    })

    it('acknowledges a terminated sync', () => {
        eventBus.emitEvent(new ArgoSyncTerminatedEvent('prod', 'argocd', 'web'))

        expect(toastStore.items[0].message).toBe('Asked Argo CD to stop the sync of argocd/web')
    })

    it('says whether a delete took the deployed resources with it', () => {
        eventBus.emitEvent(new ArgoApplicationDeletedEvent('prod', 'argocd', 'web', true))

        expect(toastStore.items[0].message).toBe('Deleted application argocd/web')
        expect(toastStore.items[0].description).toBe('The resources it deployed are deleted with it')
    })

    it('reports an automation change in the direction it went', () => {
        eventBus.emitEvent(new ArgoAutoSyncChangedEvent('prod', 'argocd', 'web', false))

        expect(toastStore.items[0].message).toBe('Disabled automated sync for argocd/web')
    })
})
