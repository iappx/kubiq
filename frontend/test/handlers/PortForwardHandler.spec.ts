import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const fake = vi.hoisted(() => ({
    clusters: [] as string[],
    ports: [] as { clusterId: string, name: string }[],
}))

vi.mock('@/application/services/portForward/PortForwardService', () => ({
    PortForwardService: class {
        public async start(): Promise<never> {
            throw new Error('not used in this spec')
        }

        public async stop(): Promise<null> {
            return null
        }

        public async closeCluster(clusterId: string): Promise<never[]> {
            fake.clusters.push(clusterId)
            return []
        }

        public async closeAll(): Promise<void> {}

        public async open(): Promise<void> {}

        public async ports(clusterId: string, namespace: string, resource: string, name: string): Promise<never[]> {
            fake.ports.push({ clusterId, name })
            return []
        }

        public list(): never[] {
            return []
        }

        public urlOf(): string {
            return ''
        }
    },
}))

import { PortForwardHandler } from '@/application/handlers/terminal/PortForwardHandler'
import { PortForwardNotificationHandler } from '@/application/handlers/terminal/PortForwardNotificationHandler'
import { ClusterDisconnectedEvent } from '@/domain/events/cluster/ClusterDisconnectedEvent'
import { DockTabClosedEvent } from '@/domain/events/dock/DockTabClosedEvent'
import { OpenPortForwardEvent } from '@/domain/events/terminal/OpenPortForwardEvent'
import { PortForwardStartedEvent } from '@/domain/events/terminal/PortForwardStartedEvent'
import { PortForwardStoppedEvent } from '@/domain/events/terminal/PortForwardStoppedEvent'
import { PortForwardKey } from '@/domain/models/terminal'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'
import { DockStore } from '@/store/modules/dock/DockStore'
import { PortForwardStore } from '@/store/modules/portForward/PortForwardStore'
import { ToastStore } from '@/store/modules/toast/ToastStore'

// Resolved once: a second instance would leave the first one listening on the same bus.
container.resolve(PortForwardHandler)
container.resolve(PortForwardNotificationHandler)

const eventBus = container.resolve(EventBus)
const dockStore = container.resolve(DockStore)
const uiStore = container.resolve(AppUiStore)
const portForwardStore = container.resolve(PortForwardStore)
const toastStore = container.resolve(ToastStore)

const settle = (): Promise<unknown> => new Promise(resolve => setTimeout(resolve, 0))

describe('PortForwardHandler', () => {
    beforeEach(() => {
        dockStore.tabs = []
        dockStore.activeKey = ''
        portForwardStore.forwards = []
        portForwardStore.target = null
        toastStore.items = []
        uiStore.dockCollapsed = true
        fake.clusters.length = 0
        fake.ports.length = 0
    })

    it('opens one forwards tab for the cluster and points it at the target', async () => {
        eventBus.emitEvent(new OpenPortForwardEvent('prod', 'payments', 'services', 'api', 8080))
        await settle()

        expect(dockStore.tabs).toHaveLength(1)
        expect(dockStore.tabs[0].key).toBe(PortForwardKey.of('prod'))
        expect(dockStore.tabs[0].label).toBe(PortForwardHandler.tabLabel)
        expect(uiStore.dockCollapsed).toBe(false)
        expect(portForwardStore.target?.name).toBe('api')
        expect(fake.ports).toEqual([{ clusterId: 'prod', name: 'api' }])
    })

    it('reuses the same tab for a second target on the same cluster', async () => {
        eventBus.emitEvent(new OpenPortForwardEvent('prod', 'payments', 'services', 'api', 8080))
        await settle()
        eventBus.emitEvent(new OpenPortForwardEvent('prod', 'web', 'pods', 'nginx-0', 80))
        await settle()

        expect(dockStore.tabs).toHaveLength(1)
        expect(portForwardStore.target?.name).toBe('nginx-0')
    })

    // The panel lists forwards, it does not own them: closing it must not stop anything.
    it('forgets the target but keeps the forwards when the tab is closed', async () => {
        eventBus.emitEvent(new OpenPortForwardEvent('prod', 'payments', 'services', 'api', 8080))
        await settle()

        eventBus.emitEvent(new DockTabClosedEvent(PortForwardKey.of('prod')))
        await settle()

        expect(portForwardStore.target).toBeNull()
        expect(fake.clusters).toHaveLength(0)
    })

    it('stops the forwards of a cluster that was disconnected', async () => {
        eventBus.emitEvent(new ClusterDisconnectedEvent('prod', 'prod', 0))
        await settle()

        expect(fake.clusters).toEqual(['prod'])
    })

    it('tells the user a forward started and where to reach it', async () => {
        eventBus.emitEvent(new PortForwardStartedEvent('prod', 'forward-1', 'svc/api:8080', 41234))
        await settle()

        expect(toastStore.items).toHaveLength(1)
        expect(toastStore.items[0].message).toContain('svc/api:8080')
        expect(toastStore.items[0].description).toContain('41234')
    })

    it('tells the user the port is free again', async () => {
        eventBus.emitEvent(new PortForwardStoppedEvent('prod', 'forward-1', 'svc/api:8080', 41234))
        await settle()

        expect(toastStore.items).toHaveLength(1)
        expect(toastStore.items[0].message).toContain('Stopped forwarding')
    })
})
