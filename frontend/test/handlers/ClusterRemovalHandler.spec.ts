import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'
import { ClusterRemovalHandler } from '@/application/handlers/cluster/ClusterRemovalHandler'
import { ClusterRemovedEvent } from '@/domain/events/cluster/ClusterRemovedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ClusterConnectionStore } from '@/store/modules/clusterConnection/ClusterConnectionStore'

container.resolve(ClusterRemovalHandler)
const eventBus = container.resolve(EventBus)
const connectionStore = container.resolve(ClusterConnectionStore)

const connection = (clusterId: string) => ({
    clusterId,
    contextName: clusterId,
    server: `https://${clusterId}.example.internal:6443`,
    sessionId: `session-${clusterId}`,
    version: 'v1.31.2',
    canOpenChannel: true,
    channelBlockReason: '',
    connectedAt: 1,
})

describe('ClusterRemovalHandler', () => {
    beforeEach(() => {
        connectionStore.connections = []
        vi.restoreAllMocks()
    })

    it('closes the session of a cluster that was deleted while connected', () => {
        connectionStore.connections = [connection('prod')]
        const disconnect = vi.spyOn(connectionStore, 'disconnect').mockResolvedValue()

        eventBus.emitEvent(new ClusterRemovedEvent('D:/work/prod.yaml', ['prod'], false))

        expect(disconnect).toHaveBeenCalledWith('prod')
    })

    it('closes every session the kubeconfig was holding open', () => {
        connectionStore.connections = [connection('prod'), connection('lab')]
        const disconnect = vi.spyOn(connectionStore, 'disconnect').mockResolvedValue()

        eventBus.emitEvent(new ClusterRemovedEvent('D:/work/all.yaml', ['prod', 'lab'], true))

        expect(disconnect.mock.calls.map(([clusterId]) => clusterId)).toEqual(['prod', 'lab'])
    })

    it('leaves a cluster that was never connected alone', () => {
        const disconnect = vi.spyOn(connectionStore, 'disconnect').mockResolvedValue()

        eventBus.emitEvent(new ClusterRemovedEvent('D:/work/prod.yaml', ['prod'], false))

        expect(disconnect).not.toHaveBeenCalled()
    })
})
