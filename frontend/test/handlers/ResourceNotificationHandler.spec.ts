import { beforeEach, describe, expect, it } from 'vitest'
import { container } from 'tsyringe'
import { ResourceNotificationHandler } from '@/application/handlers/resource/ResourceNotificationHandler'
import { BulkActionCompletedEvent } from '@/domain/events/cluster/BulkActionCompletedEvent'
import { ResourceAppliedEvent } from '@/domain/events/cluster/ResourceAppliedEvent'
import { ResourceCreatedEvent } from '@/domain/events/cluster/ResourceCreatedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ToastStore } from '@/store/modules/toast/ToastStore'

container.resolve(ResourceNotificationHandler)
const eventBus = container.resolve(EventBus)
const toastStore = container.resolve(ToastStore)

const last = () => toastStore.items[toastStore.items.length - 1]

describe('ResourceNotificationHandler', () => {
    beforeEach(() => {
        toastStore.items = []
    })

    it('acknowledges an applied manifest', () => {
        eventBus.emitEvent(new ResourceAppliedEvent('prod', 'Deployment', 'api', 'payments', false))

        expect(last()).toMatchObject({
            type: 'success',
            message: 'Applied Deployment payments/api',
            description: 'Only the changed fields were sent',
        })
    })

    it('acknowledges a created object', () => {
        eventBus.emitEvent(new ResourceCreatedEvent('prod', 'ConfigMap', 'app-cfg', 'payments'))

        expect(last()).toMatchObject({
            type: 'success',
            message: 'Created ConfigMap payments/app-cfg',
        })
    })

    it('shows a single success toast for a completed bulk delete', () => {
        eventBus.emitEvent(new BulkActionCompletedEvent('prod', 'delete', 'Pod', 'Pods', 4, 0))

        expect(last()).toMatchObject({
            type: 'success',
            message: 'Deleted 4 Pods',
        })
    })

    it('uses the singular kind name when one object succeeded', () => {
        eventBus.emitEvent(new BulkActionCompletedEvent('prod', 'restart', 'Deployment', 'Deployments', 1, 0))

        expect(last()).toMatchObject({
            type: 'success',
            message: 'Restarted 1 Deployment',
        })
    })

    it('shows a success toast for bulk cordon and uncordon', () => {
        eventBus.emitEvent(new BulkActionCompletedEvent('prod', 'cordon', 'Node', 'Nodes', 2, 0))
        expect(last()).toMatchObject({ type: 'success', message: 'Cordoned 2 Nodes' })

        eventBus.emitEvent(new BulkActionCompletedEvent('prod', 'uncordon', 'Node', 'Nodes', 3, 0))
        expect(last()).toMatchObject({ type: 'success', message: 'Uncordoned 3 Nodes' })
    })

    it('shows a warning toast with failure count on partial bulk failure', () => {
        eventBus.emitEvent(new BulkActionCompletedEvent('prod', 'delete', 'Pod', 'Pods', 3, 2))

        expect(last()).toMatchObject({
            type: 'warning',
            message: 'Deleted 3 of 5 Pods',
            description: '2 failed',
        })
    })

    it('shows an error toast when every item in a bulk event failed', () => {
        eventBus.emitEvent(new BulkActionCompletedEvent('prod', 'cordon', 'Node', 'Nodes', 0, 2))

        expect(last()).toMatchObject({
            type: 'error',
            message: 'Could not cordon 2 Nodes',
        })
    })
})
