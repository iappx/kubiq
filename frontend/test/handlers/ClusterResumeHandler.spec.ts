import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const fake = vi.hoisted(() => {
    const state = {
        probeResult: {} as Record<string, boolean>,
        kinds: {} as Record<string, unknown[]>,
    }

    return {
        state,
        resetIdle: vi.fn(async () => undefined),
        probe: vi.fn(async (clusterId: string) => state.probeResult[clusterId] ?? true),
        listKinds: vi.fn(async (clusterId: string) => state.kinds[clusterId] ?? []),
    }
})

vi.mock('@/application/services/cluster/ClusterConnectionService', () => ({
    ClusterConnectionService: class {
        public resetIdle = fake.resetIdle

        public probe = fake.probe
    },
}))

vi.mock('@/application/services/clusterDiscovery/ClusterDiscoveryService', () => ({
    ClusterDiscoveryService: class {
        public listKinds = fake.listKinds
    },
}))

import { ClusterHealthHandler } from '@/application/handlers/cluster/ClusterHealthHandler'
import { ClusterResumeHandler } from '@/application/handlers/cluster/ClusterResumeHandler'
import type { TClusterConnection } from '@/application/services/cluster/types/TClusterConnection'
import { ApiError } from '@/domain/errors/ApiError'
import { AppConnectivityEvent } from '@/domain/events/app/AppConnectivityEvent'
import { AppResumedEvent } from '@/domain/events/app/AppResumedEvent'
import { KubeResourceRegistry } from '@/domain/models/kube'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { KubeHealthMonitor } from '@/infrastructure/kube/KubeHealthMonitor'
import { ClusterConnectionStore } from '@/store/modules/clusterConnection/ClusterConnectionStore'
import { ClusterDiscoveryStore } from '@/store/modules/clusterDiscovery/ClusterDiscoveryStore'
import { ClusterHealthStore } from '@/store/modules/clusterHealth/ClusterHealthStore'

container.resolve(ClusterHealthHandler)
container.resolve(ClusterResumeHandler)
const eventBus = container.resolve(EventBus)
const connectionStore = container.resolve(ClusterConnectionStore)
const discoveryStore = container.resolve(ClusterDiscoveryStore)
const healthStore = container.resolve(ClusterHealthStore)
const healthMonitor = container.resolve(KubeHealthMonitor)

const pods = KubeResourceRegistry.find('', 'pods')!

const connection = (clusterId: string): TClusterConnection => ({
    clusterId,
    contextName: clusterId,
    server: `https://${clusterId}.example.internal:6443`,
    sessionId: `session-${clusterId}`,
    version: 'v1.31.0',
    canOpenChannel: true,
    channelBlockReason: '',
    connectedAt: 1,
})

describe('ClusterResumeHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        fake.state.probeResult = {}
        fake.state.kinds = { prod: [pods], staging: [pods] }

        connectionStore.connections = []
        discoveryStore.kinds = {}
        discoveryStore.failures = {}
        discoveryStore.loadingIds = []
        healthStore.health = {}
        healthStore.details = {}
        healthStore.online = true
        healthMonitor.forgetAll()
    })

    it('resets idle connections and reloads failed or empty discovery on resume', async () => {
        connectionStore.connections = [connection('prod'), connection('staging')]
        discoveryStore.kinds = { prod: [pods], staging: [] }

        eventBus.emitEvent(new AppResumedEvent(60_000))

        await vi.waitFor(() => {
            expect(fake.resetIdle).toHaveBeenCalledTimes(1)
            expect(fake.listKinds).toHaveBeenCalledWith('staging')
        })

        expect(fake.listKinds).toHaveBeenCalledTimes(1)
        expect(discoveryStore.kindsOf('staging')).toHaveLength(1)
    })

    it('reloads discovery when a connected cluster previously recorded a discovery failure', async () => {
        connectionStore.connections = [connection('prod')]
        discoveryStore.kinds = { prod: [pods] }
        discoveryStore.failures = { prod: 'timeout' }

        eventBus.emitEvent(new AppConnectivityEvent(true))

        await vi.waitFor(() => {
            expect(fake.resetIdle).toHaveBeenCalledTimes(1)
            expect(fake.listKinds).toHaveBeenCalledWith('prod')
        })

        expect(discoveryStore.failureOf('prod')).toBe('')
    })

    it('ignores offline connectivity events', async () => {
        connectionStore.connections = [connection('prod')]

        eventBus.emitEvent(new AppConnectivityEvent(false))
        await Promise.resolve()

        expect(fake.resetIdle).not.toHaveBeenCalled()
        expect(fake.probe).not.toHaveBeenCalled()
        expect(fake.listKinds).not.toHaveBeenCalled()
    })

    it('probes unreachable clusters, restores healthy state, and reloads empty discovery when reachable', async () => {
        connectionStore.connections = [connection('prod')]
        fake.state.probeResult = { prod: true }
        const failure = new ApiError('Could not reach the cluster', 'dial tcp: connection refused', 0)
        healthMonitor.failed('prod', failure)
        healthMonitor.failed('prod', failure)
        expect(healthStore.healthOf('prod')).toBe('unreachable')

        eventBus.emitEvent(new AppResumedEvent(30_000))

        await vi.waitFor(() => {
            expect(healthStore.healthOf('prod')).toBe('healthy')
            expect(discoveryStore.kindsOf('prod')).toHaveLength(1)
        })

        expect(fake.probe).toHaveBeenCalledWith('prod')
    })

    it('probes degraded clusters and marks them healthy when reachable', async () => {
        connectionStore.connections = [connection('prod')]
        discoveryStore.kinds = { prod: [pods] }
        fake.state.probeResult = { prod: true }
        const failure = new ApiError('The cluster did not answer in time.', 'context deadline exceeded', 0)
        healthMonitor.failed('prod', failure)
        healthMonitor.failed('prod', failure)
        expect(healthStore.healthOf('prod')).toBe('degraded')

        eventBus.emitEvent(new AppConnectivityEvent(true))

        await vi.waitFor(() => {
            expect(healthStore.healthOf('prod')).toBe('healthy')
        })

        expect(fake.probe).toHaveBeenCalledWith('prod')
        expect(fake.listKinds).not.toHaveBeenCalled()
    })

    it('leaves a still-unreachable cluster degraded and skips discovery reload when probe fails', async () => {
        connectionStore.connections = [connection('prod')]
        fake.state.probeResult = { prod: false }
        const failure = new ApiError('Could not reach the cluster', 'dial tcp: connection refused', 0)
        healthMonitor.failed('prod', failure)
        healthMonitor.failed('prod', failure)

        eventBus.emitEvent(new AppResumedEvent(30_000))

        await vi.waitFor(() => {
            expect(fake.probe).toHaveBeenCalledWith('prod')
        })

        expect(healthStore.healthOf('prod')).toBe('unreachable')
        expect(fake.listKinds).not.toHaveBeenCalled()
    })
})
