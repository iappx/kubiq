import { beforeEach, describe, expect, it } from 'vitest'
import { container } from 'tsyringe'
import { ClusterHealthHandler } from '@/application/handlers/cluster/ClusterHealthHandler'
import { AppConnectivityEvent } from '@/domain/events/app/AppConnectivityEvent'
import { ClusterHealthChangedEvent } from '@/domain/events/cluster/ClusterHealthChangedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ClusterHealthStore } from '@/store/modules/clusterHealth/ClusterHealthStore'
import { ToastStore } from '@/store/modules/toast/ToastStore'

container.resolve(ClusterHealthHandler)
const eventBus = container.resolve(EventBus)
const healthStore = container.resolve(ClusterHealthStore)
const toastStore = container.resolve(ToastStore)

const last = () => toastStore.items[toastStore.items.length - 1]

describe('ClusterHealthHandler', () => {
    beforeEach(() => {
        toastStore.items = []
        healthStore.health = {}
        healthStore.details = {}
        healthStore.online = true
    })

    it('puts what the monitor reported into the store', () => {
        eventBus.emitEvent(new ClusterHealthChangedEvent('prod', 'expired', 'The cluster rejected the credentials.'))

        expect(healthStore.healthOf('prod')).toBe('expired')
        expect(healthStore.detailOf('prod')).toBe('The cluster rejected the credentials.')
    })

    it('leaves the toast for a refused request to the error handler', () => {
        eventBus.emitEvent(new ClusterHealthChangedEvent('prod', 'expired', 'The cluster rejected the credentials.'))

        expect(toastStore.items).toEqual([])
    })

    it('says the network went away, because no request was refused to say it', () => {
        eventBus.emitEvent(new AppConnectivityEvent(false))

        expect(healthStore.online).toBe(false)
        expect(last()).toMatchObject({ type: 'warning', message: 'No network' })
    })

    it('says the network came back and that lists recover on their own', () => {
        eventBus.emitEvent(new AppConnectivityEvent(true))

        expect(healthStore.online).toBe(true)
        expect(last()).toMatchObject({ type: 'success', message: 'Back online' })
    })

    it('lets a cluster recover without a reconnect', () => {
        eventBus.emitEvent(new ClusterHealthChangedEvent('prod', 'unreachable', 'gone'))
        eventBus.emitEvent(new ClusterHealthChangedEvent('prod', 'healthy', ''))

        expect(healthStore.isSettled('prod')).toBe(true)
    })
})
