import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const fake = vi.hoisted(() => ({
    opened: [] as { kind: string, key: string }[],
    closed: [] as string[],
    clusters: [] as string[],
}))

vi.mock('@/application/services/terminal/TerminalService', () => ({
    TerminalService: class {
        public async openExec(key: string): Promise<void> {
            fake.opened.push({ kind: 'exec', key })
        }

        public async openNodeShell(key: string): Promise<void> {
            fake.opened.push({ kind: 'node', key })
        }

        public async openLocalShell(key: string): Promise<void> {
            fake.opened.push({ kind: 'local', key })
        }

        public async close(key: string): Promise<void> {
            fake.closed.push(key)
        }

        public async closeCluster(clusterId: string): Promise<void> {
            fake.clusters.push(clusterId)
        }

        public async closeAll(): Promise<void> {}

        public attachView(): void {}

        public detachView(): void {}

        public has(): boolean {
            return false
        }

        public async listNodes(): Promise<string[]> {
            return []
        }
    },
}))

import { TerminalHandler } from '@/application/handlers/terminal/TerminalHandler'
import { ClusterDisconnectedEvent } from '@/domain/events/cluster/ClusterDisconnectedEvent'
import { DockTabClosedEvent } from '@/domain/events/dock/DockTabClosedEvent'
import { OpenLocalShellEvent } from '@/domain/events/terminal/OpenLocalShellEvent'
import { OpenNodeShellEvent } from '@/domain/events/terminal/OpenNodeShellEvent'
import { OpenPodShellEvent } from '@/domain/events/terminal/OpenPodShellEvent'
import { PodLogKey } from '@/domain/models/kube'
import { TerminalKey } from '@/domain/models/terminal'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { AppUiStore } from '@/store/modules/appUi/AppUiStore'
import { DockStore } from '@/store/modules/dock/DockStore'
import { TerminalStore } from '@/store/modules/terminal/TerminalStore'

// Resolved once: a second instance would leave the first one listening on the same bus.
container.resolve(TerminalHandler)

const eventBus = container.resolve(EventBus)
const dockStore = container.resolve(DockStore)
const uiStore = container.resolve(AppUiStore)
const terminalStore = container.resolve(TerminalStore)

const settle = (): Promise<unknown> => new Promise(resolve => setTimeout(resolve, 0))

describe('TerminalHandler', () => {
    beforeEach(() => {
        dockStore.tabs = []
        dockStore.activeKey = ''
        terminalStore.views = {}
        uiStore.dockCollapsed = true
        fake.opened.length = 0
        fake.closed.length = 0
        fake.clusters.length = 0
    })

    it('opens a dock tab labelled for the container being entered', async () => {
        eventBus.emitEvent(new OpenPodShellEvent('prod', 'payments', 'api-0', 'app'))
        await settle()

        expect(dockStore.tabs).toHaveLength(1)
        expect(dockStore.tabs[0].label).toBe('api-0/app')
        expect(dockStore.tabs[0].clusterId).toBe('prod')
        expect(TerminalKey.isTerminal(dockStore.activeKey)).toBe(true)
        expect(fake.opened[0].kind).toBe('exec')
    })

    // Collapsing the dock does not stop a stream, but opening into a collapsed dock hides it.
    it('expands the dock so the new tab is visible', async () => {
        eventBus.emitEvent(new OpenLocalShellEvent('prod', 'payments'))
        await settle()

        expect(uiStore.dockCollapsed).toBe(false)
        expect(fake.opened[0].kind).toBe('local')
    })

    it('opens a node shell tab', async () => {
        eventBus.emitEvent(new OpenNodeShellEvent('prod', 'worker-1'))
        await settle()

        expect(dockStore.tabs[0].label).toBe('node/worker-1')
        expect(fake.opened[0].kind).toBe('node')
    })

    it('opens a tab of its own for every shell into the same pod', async () => {
        eventBus.emitEvent(new OpenPodShellEvent('prod', 'payments', 'api-0', 'app'))
        await settle()
        eventBus.emitEvent(new OpenPodShellEvent('prod', 'payments', 'api-0', 'app'))
        await settle()

        expect(dockStore.tabs).toHaveLength(2)
    })

    it('stops the session when its tab is closed', async () => {
        eventBus.emitEvent(new OpenPodShellEvent('prod', 'payments', 'api-0', 'app'))
        await settle()

        const key = dockStore.activeKey
        eventBus.emitEvent(new DockTabClosedEvent(key))
        await settle()

        expect(fake.closed).toEqual([key])
        expect(terminalStore.has(key)).toBe(false)
    })

    it('ignores a tab that belongs to somebody else', async () => {
        eventBus.emitEvent(new DockTabClosedEvent(PodLogKey.of('prod', 'payments', 'api-0', 'app')))
        await settle()

        expect(fake.closed).toHaveLength(0)
    })

    it('closes the terminals of a cluster that was disconnected', async () => {
        eventBus.emitEvent(new ClusterDisconnectedEvent('prod', 'prod', 0))
        await settle()

        expect(fake.clusters).toEqual(['prod'])
    })
})
