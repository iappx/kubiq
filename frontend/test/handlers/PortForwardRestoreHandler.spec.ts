import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const fake = vi.hoisted(() => ({
    records: [] as any[],
    connected: new Set<string>(),
    started: [] as string[],
    stoppedClusters: [] as string[],
    connects: [] as string[],
    stoppedAll: 0,
}))

vi.mock('@/application/services/portForward/PortForwardService', () => ({
    PortForwardService: class {
        public async list(): Promise<any[]> {
            return fake.records.map(record => ({ ...record }))
        }

        public isConnected(clusterId: string): boolean {
            return fake.connected.has(clusterId)
        }

        public async start(forward: any): Promise<any> {
            fake.started.push(forward.id)
            return { status: 'active', error: '', boundPort: 40001, podName: forward.name, targetPort: 8080 }
        }

        public async rememberPort(): Promise<void> {}

        public async stop(): Promise<boolean> {
            return true
        }

        public async stopCluster(clusterId: string): Promise<string[]> {
            fake.stoppedClusters.push(clusterId)
            return []
        }

        public async stopAll(): Promise<void> {
            fake.stoppedAll += 1
        }
    },
}))

vi.mock('@/application/services/clusterEntry/ClusterEntryService', () => ({
    ClusterEntryService: class {
        public async connectInBackground(clusterId: string): Promise<boolean> {
            fake.connects.push(clusterId)
            return false
        }
    },
}))

const record = (id: string, clusterId: string, restoreMode: string): Record<string, unknown> => ({
    id,
    clusterId,
    namespace: 'payments',
    resource: 'services',
    name: 'api',
    remotePort: 8080,
    localPort: 0,
    lastLocalPort: 40001,
    restoreMode,
    createdAt: 1,
    label: 'svc/api:8080',
    status: restoreMode === 'manual' ? 'stopped' : 'waiting',
    error: '',
    boundPort: 0,
    podName: '',
    targetPort: 0,
})

fake.records = [record('pf-1', 'prod', 'onConnect'), record('pf-2', 'lab', 'connectOnStart')]

import { PortForwardRestoreHandler } from '@/application/handlers/terminal/PortForwardRestoreHandler'
import { ClusterConnectedEvent } from '@/domain/events/cluster/ClusterConnectedEvent'
import { ClusterDisconnectedEvent } from '@/domain/events/cluster/ClusterDisconnectedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { PortForwardStore } from '@/store/modules/portForward/PortForwardStore'

// Resolved once: a second instance would leave the first one listening on the same bus.
container.resolve(PortForwardRestoreHandler)

const eventBus = container.resolve(EventBus)
const store = container.resolve(PortForwardStore)

const settle = async (): Promise<void> => {
    for (let pass = 0; pass < 5; pass++) {
        await new Promise(resolve => setTimeout(resolve, 0))
    }
}

describe('PortForwardRestoreHandler', () => {
    beforeEach(async () => {
        await settle()
        fake.started.length = 0
        fake.stoppedClusters.length = 0
    })

    it('loads the saved forwards on start and connects the clusters that ask for it', () => {
        expect(store.loaded).toBe(true)
        expect(store.forwards.map(forward => forward.id)).toEqual(['pf-1', 'pf-2'])
        expect(fake.connects).toEqual(['lab'])
    })

    it('starts the forwards of a cluster that connects', async () => {
        fake.connected.add('prod')

        eventBus.emitEvent(new ClusterConnectedEvent('prod', 'prod', 'v1.30.1'))
        await settle()

        expect(fake.started).toEqual(['pf-1'])
        expect(store.find('pf-1')?.status).toBe('active')
    })

    it('stops the forwards of a cluster that disconnects and keeps them waiting', async () => {
        fake.connected.delete('prod')

        eventBus.emitEvent(new ClusterDisconnectedEvent('prod', 'prod', 0))
        await settle()

        expect(fake.stoppedClusters).toEqual(['prod'])
        expect(store.find('pf-1')?.status).toBe('waiting')
        expect(store.forwards).toHaveLength(2)
    })

    it('closes every listener when the window unloads, and keeps the records', async () => {
        window.dispatchEvent(new Event('beforeunload'))
        await settle()

        expect(fake.stoppedAll).toBe(1)
        expect(store.forwards).toHaveLength(2)
    })
})
