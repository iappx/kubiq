import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const fake = vi.hoisted(() => ({
    opened: [] as string[],
    closed: [] as string[],
    clusters: [] as string[],
}))

vi.mock('@/application/services/podLogs/PodLogsService', () => ({
    PodLogsService: class {
        public async open(request: { key: string }): Promise<void> {
            fake.opened.push(request.key)
        }

        public async close(key: string): Promise<void> {
            fake.closed.push(key)
        }

        public async closeCluster(clusterId: string): Promise<void> {
            fake.clusters.push(clusterId)
        }

        public has(): boolean {
            return false
        }

        public lines(): readonly string[] {
            return []
        }

        public async containers(): Promise<never[]> {
            return []
        }
    },
}))

import { PodLogsHandler } from '@/application/handlers/logs/PodLogsHandler'
import { DockSessionHandler } from '@/application/handlers/dock/DockSessionHandler'
import { ClusterDisconnectedEvent } from '@/domain/events/cluster/ClusterDisconnectedEvent'
import { DockTabClosedEvent } from '@/domain/events/dock/DockTabClosedEvent'
import { OpenPodLogsEvent } from '@/domain/events/cluster/OpenPodLogsEvent'
import { PodLogKey } from '@/domain/models/kube'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'
import { DockStore } from '@/store/modules/dock/DockStore'
import { PodLogsStore } from '@/store/modules/podLogs/PodLogsStore'

// Resolved once: a second instance would leave the first one listening on the same bus.
container.resolve(PodLogsHandler)
container.resolve(DockSessionHandler)

const eventBus = container.resolve(EventBus)
const dockStore = container.resolve(DockStore)
const uiStore = container.resolve(AppUiStore)
const podLogsStore = container.resolve(PodLogsStore)

const settle = () => new Promise(resolve => setTimeout(resolve, 0))

describe('PodLogsHandler', () => {
    beforeEach(() => {
        dockStore.tabs = []
        dockStore.activeKey = ''
        podLogsStore.views = {}
        uiStore.dockCollapsed = true
        fake.opened.length = 0
        fake.closed.length = 0
        fake.clusters.length = 0
    })

    it('opens a dock tab labelled pod/container', async () => {
        eventBus.emitEvent(new OpenPodLogsEvent('prod', 'payments', 'api-0', 'app'))
        await settle()

        expect(dockStore.tabs).toHaveLength(1)
        expect(dockStore.tabs[0].label).toBe('api-0/app')
        expect(dockStore.tabs[0].clusterId).toBe('prod')
        expect(dockStore.activeKey).toBe(PodLogKey.of('prod', 'payments', 'api-0', 'app'))
    })

    it('labels the tab with the pod alone when the cluster picks the container', async () => {
        eventBus.emitEvent(new OpenPodLogsEvent('prod', 'payments', 'api-0'))
        await settle()

        expect(dockStore.tabs[0].label).toBe('api-0')
    })

    it('expands a collapsed dock', async () => {
        eventBus.emitEvent(new OpenPodLogsEvent('prod', 'payments', 'api-0', 'app'))
        await settle()

        expect(uiStore.dockCollapsed).toBe(false)
    })

    it('starts the stream for the tab it opened', async () => {
        eventBus.emitEvent(new OpenPodLogsEvent('prod', 'payments', 'api-0', 'app'))
        await settle()

        expect(fake.opened).toEqual([PodLogKey.of('prod', 'payments', 'api-0', 'app')])
    })

    it('reopens the same stream in the tab it already has', async () => {
        eventBus.emitEvent(new OpenPodLogsEvent('prod', 'payments', 'api-0', 'app'))
        eventBus.emitEvent(new OpenPodLogsEvent('prod', 'payments', 'api-0', 'app'))
        await settle()

        expect(dockStore.tabs).toHaveLength(1)
    })

    it('gives a second container a tab of its own', async () => {
        eventBus.emitEvent(new OpenPodLogsEvent('prod', 'payments', 'api-0', 'app'))
        eventBus.emitEvent(new OpenPodLogsEvent('prod', 'payments', 'api-0', 'sidecar'))
        await settle()

        expect(dockStore.tabs.map(tab => tab.label)).toEqual(['api-0/app', 'api-0/sidecar'])
    })

    it('stops the stream when its tab is closed', async () => {
        const key = PodLogKey.of('prod', 'payments', 'api-0', 'app')
        eventBus.emitEvent(new OpenPodLogsEvent('prod', 'payments', 'api-0', 'app'))
        await settle()

        eventBus.emitEvent(new DockTabClosedEvent(key))
        await settle()

        expect(fake.closed).toContain(key)
    })

    it('leaves a tab that is not a log stream alone', async () => {
        eventBus.emitEvent(new DockTabClosedEvent('shell|prod|payments|api-0|app'))
        await settle()

        expect(fake.closed).toHaveLength(0)
    })

    it('closes every tab and stream of a disconnected cluster', async () => {
        eventBus.emitEvent(new OpenPodLogsEvent('prod', 'payments', 'api-0', 'app'))
        eventBus.emitEvent(new OpenPodLogsEvent('prod', 'payments', 'api-1', 'app'))
        eventBus.emitEvent(new OpenPodLogsEvent('lab', 'payments', 'api-0', 'app'))
        await settle()

        eventBus.emitEvent(new ClusterDisconnectedEvent('prod', 'prod', 2))
        await settle()

        expect(dockStore.tabs).toHaveLength(1)
        expect(dockStore.tabs[0].clusterId).toBe('lab')
        expect(fake.clusters).toContain('prod')
    })
})
