import { beforeEach, describe, expect, it } from 'vitest'
import { container } from 'tsyringe'
import { ClusterNotificationHandler } from '@/application/handlers/cluster/ClusterNotificationHandler'
import { ClusterConnectedEvent } from '@/domain/events/cluster/ClusterConnectedEvent'
import { ClusterDisconnectedEvent } from '@/domain/events/cluster/ClusterDisconnectedEvent'
import { ClusterRemovedEvent } from '@/domain/events/cluster/ClusterRemovedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ToastStore } from '@/store/modules/toast/ToastStore'

// Resolved once: the handler subscribes in its constructor, and a second instance would
// leave the first one listening on the same bus.
container.resolve(ClusterNotificationHandler)
const eventBus = container.resolve(EventBus)
const toasts = container.resolve(ToastStore)

describe('ClusterNotificationHandler', () => {
    beforeEach(() => {
        toasts.items = []
    })

    it('stays quiet when a connection opens, because entering the cluster is the feedback', () => {
        eventBus.emitEvent(new ClusterConnectedEvent('prod', 'prod', 'v1.31.2'))

        expect(toasts.items).toEqual([])
    })

    it('says nothing about streams when none were open', () => {
        eventBus.emitEvent(new ClusterDisconnectedEvent('prod', 'prod', 0))

        expect(toasts.items).toHaveLength(1)
        expect(toasts.items[0].type).toBe('success')
        expect(toasts.items[0].message).toBe('Disconnected from prod')
        expect(toasts.items[0].description).toBeUndefined()
    })

    it('counts the streams it stopped, in singular and plural', () => {
        eventBus.emitEvent(new ClusterDisconnectedEvent('prod', 'prod', 1))
        eventBus.emitEvent(new ClusterDisconnectedEvent('lab', 'lab', 4))

        expect(toasts.items[0].description).toBe('One open stream was stopped')
        expect(toasts.items[1].description).toBe('4 open streams were stopped')
    })

    it('names the deleted cluster and says its saved kubeconfig went with it', () => {
        eventBus.emitEvent(new ClusterRemovedEvent('C:/kubiq/kubeconfigs/prod.yaml', ['prod'], true))

        expect(toasts.items[0].message).toBe('Deleted cluster prod')
        expect(toasts.items[0].description).toBe('The kubeconfig Kubiq saved for it was deleted too')
    })

    it('counts the clusters a shared kubeconfig took with it, and says the file stayed', () => {
        eventBus.emitEvent(new ClusterRemovedEvent('D:/work/all.yaml', ['prod', 'lab'], false))

        expect(toasts.items[0].message).toBe('Deleted 2 clusters')
        expect(toasts.items[0].description).toBe('D:/work/all.yaml was left on disk')
    })

    it('claims no cluster when the file had stopped yielding one', () => {
        eventBus.emitEvent(new ClusterRemovedEvent('D:/work/gone.yaml', [], false))

        expect(toasts.items[0].message).toBe('Removed kubeconfig')
    })
})
