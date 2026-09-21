import { beforeEach, describe, expect, it } from 'vitest'
import { container } from 'tsyringe'
import { ClusterAdminNotificationHandler } from '@/application/handlers/cluster/ClusterAdminNotificationHandler'
import { NamespaceCreatedEvent } from '@/domain/events/cluster/NamespaceCreatedEvent'
import { NodeDrainedEvent } from '@/domain/events/cluster/NodeDrainedEvent'
import { NodeSchedulingChangedEvent } from '@/domain/events/cluster/NodeSchedulingChangedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ToastStore } from '@/store/modules/toast/ToastStore'

container.resolve(ClusterAdminNotificationHandler)
const eventBus = container.resolve(EventBus)
const toastStore = container.resolve(ToastStore)

const last = () => toastStore.items[toastStore.items.length - 1]

describe('ClusterAdminNotificationHandler', () => {
    beforeEach(() => {
        toastStore.items = []
    })

    it('says what cordoning did and did not do', () => {
        eventBus.emitEvent(new NodeSchedulingChangedEvent('prod', 'worker-1', true))

        expect(last()).toMatchObject({ type: 'success', message: 'Cordoned node worker-1' })
        expect(last().description).toContain('already running stay')
    })

    it('acknowledges an uncordon', () => {
        eventBus.emitEvent(new NodeSchedulingChangedEvent('prod', 'worker-1', false))

        expect(last().message).toBe('Uncordoned node worker-1')
    })

    it('reports a clean drain as a success with its counts', () => {
        eventBus.emitEvent(new NodeDrainedEvent('prod', 'worker-1', 7, 3, 0))

        expect(last()).toMatchObject({ type: 'success', message: 'Drained node worker-1' })
        expect(last().description).toBe('7 evicted, 3 left in place')
    })

    it('calls a partly refused drain a warning, not a success', () => {
        eventBus.emitEvent(new NodeDrainedEvent('prod', 'worker-1', 5, 3, 2))

        expect(last()).toMatchObject({ type: 'warning', message: 'Drained node worker-1 with 2 refusals' })
        expect(last().description).toContain('PodDisruptionBudget')
    })

    it('says refusal rather than refusals for one', () => {
        eventBus.emitEvent(new NodeDrainedEvent('prod', 'worker-1', 5, 0, 1))

        expect(last().message).toBe('Drained node worker-1 with 1 refusal')
    })

    it('acknowledges a created namespace', () => {
        eventBus.emitEvent(new NamespaceCreatedEvent('prod', 'payments'))

        expect(last()).toMatchObject({ type: 'success', message: 'Created namespace payments' })
    })
})
