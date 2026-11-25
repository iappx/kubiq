import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const fake = vi.hoisted(() => ({
    opened: [] as { kind: string, key: string }[],
    external: [] as { clusterId: string, namespace: string }[],
    externalFailure: null as Error | null,
    terminalMode: 'in-app' as 'in-app' | 'system' | 'custom',
    closed: [] as string[],
    clusters: [] as string[],
}))

vi.mock('@/application/services/settings/SettingsService', () => ({
    SettingsService: class {
        public async terminalMode(): Promise<'in-app' | 'system' | 'custom'> {
            return fake.terminalMode
        }
    },
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

        public async openExternalLocalShell(request: { clusterId: string, namespace: string }): Promise<void> {
            if (fake.externalFailure) {
                throw fake.externalFailure
            }
            fake.external.push(request)
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
import { ApiError } from '@/domain/errors/ApiError'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
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

const errors: AppErrorEvent[] = []
eventBus.registerHandler(AppErrorEvent, (event) => {
    errors.push(event)
})

const settle = (): Promise<unknown> => new Promise(resolve => setTimeout(resolve, 0))

describe('TerminalHandler', () => {
    beforeEach(() => {
        dockStore.tabs = []
        dockStore.activeKey = ''
        terminalStore.views = {}
        uiStore.dockCollapsed = true
        fake.opened.length = 0
        fake.external.length = 0
        fake.externalFailure = null
        fake.terminalMode = 'in-app'
        fake.closed.length = 0
        fake.clusters.length = 0
        errors.length = 0
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

    it.each(['system', 'custom'] as const)('launches an external terminal without opening the dock in %s mode', async (mode) => {
        fake.terminalMode = mode

        eventBus.emitEvent(new OpenLocalShellEvent('prod', 'payments'))
        await settle()

        expect(fake.external).toEqual([{ clusterId: 'prod', namespace: 'payments' }])
        expect(fake.opened).toHaveLength(0)
        expect(dockStore.tabs).toHaveLength(0)
        expect(uiStore.dockCollapsed).toBe(true)
    })

    it('emits AppErrorEvent and leaves the dock closed when external launch fails', async () => {
        fake.terminalMode = 'custom'
        fake.externalFailure = new ApiError('Custom terminal is not configured')

        eventBus.emitEvent(new OpenLocalShellEvent('prod', 'payments'))
        await settle()

        expect(errors).toHaveLength(1)
        expect(errors[0].error).toBe(fake.externalFailure)
        expect(dockStore.tabs).toHaveLength(0)
        expect(uiStore.dockCollapsed).toBe(true)
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
