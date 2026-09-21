import { beforeEach, describe, expect, it } from 'vitest'
import { container } from 'tsyringe'
import { ClusterDisconnectedEvent } from '@/domain/events/cluster/ClusterDisconnectedEvent'
import { DockSessionHandler } from '@/application/handlers/dock/DockSessionHandler'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { DockStore } from '@/store/modules/dock/DockStore'

container.resolve(DockSessionHandler)
const store = container.resolve(DockStore)
const eventBus = container.resolve(EventBus)

const tab = (key: string, clusterId: string) => ({ key, label: key, clusterId })

describe('DockStore', () => {
    beforeEach(() => {
        store.tabs = []
        store.activeKey = ''
    })

    it('opens a tab and makes it the active one', () => {
        store.open(tab('prod/api-0/app', 'prod'))

        expect(store.tabs).toHaveLength(1)
        expect(store.activeKey).toBe('prod/api-0/app')
        expect(store.hasTabs).toBe(true)
    })

    it('reopening the same stream refocuses its tab rather than adding a second', () => {
        store.open(tab('prod/api-0/app', 'prod'))
        store.open(tab('prod/worker-0/app', 'prod'))
        store.open(tab('prod/api-0/app', 'prod'))

        expect(store.tabs).toHaveLength(2)
        expect(store.activeKey).toBe('prod/api-0/app')
    })

    it('activates a tab it holds and ignores one it does not', () => {
        store.open(tab('a', 'prod'))
        store.open(tab('b', 'prod'))

        store.activate('a')
        expect(store.activeKey).toBe('a')

        store.activate('ghost')
        expect(store.activeKey).toBe('a')
    })

    it('moves the focus to a neighbour when the active tab closes', () => {
        store.open(tab('a', 'prod'))
        store.open(tab('b', 'prod'))

        store.close('b')

        expect(store.activeKey).toBe('a')
    })

    it('leaves the focus alone when another tab closes', () => {
        store.open(tab('a', 'prod'))
        store.open(tab('b', 'prod'))

        store.close('a')

        expect(store.activeKey).toBe('b')
    })

    it('has no active tab left once the last one closes', () => {
        store.open(tab('a', 'prod'))

        store.close('a')

        expect(store.activeKey).toBe('')
        expect(store.hasTabs).toBe(false)
    })

    it('lists the tabs of one cluster', () => {
        store.open(tab('a', 'prod'))
        store.open(tab('b', 'lab'))

        expect(store.tabsOf('prod').map(open => open.key)).toEqual(['a'])
    })

    it('closes the tabs of a cluster that disconnects, and only those', () => {
        store.open(tab('prod/api-0/app', 'prod'))
        store.open(tab('lab/worker-0/app', 'lab'))

        eventBus.emitEvent(new ClusterDisconnectedEvent('prod', 'prod', 1))

        expect(store.tabs.map(open => open.key)).toEqual(['lab/worker-0/app'])
        expect(store.activeKey).toBe('lab/worker-0/app')
    })

    it('does nothing when a cluster with no tabs disconnects', () => {
        store.open(tab('lab/worker-0/app', 'lab'))

        eventBus.emitEvent(new ClusterDisconnectedEvent('prod', 'prod', 0))

        expect(store.tabs).toHaveLength(1)
    })

    it('closes everything at once', () => {
        store.open(tab('a', 'prod'))
        store.open(tab('b', 'lab'))

        store.closeAll()

        expect(store.tabs).toEqual([])
        expect(store.activeKey).toBe('')
    })
})
