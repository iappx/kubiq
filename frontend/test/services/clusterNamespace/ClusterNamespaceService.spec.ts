import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

const send = vi.fn()

vi.mock('../../../bindings/iappx_k8s_admin/core/services/kube', () => ({
    KubeService: {
        Send: (...args: unknown[]) => send(...args),
    },
    Request: class {
        constructor(source: Record<string, unknown>) {
            Object.assign(this, source)
        }
    },
    StreamRequest: class {},
}))

import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { ClusterNamespaceService } from '@/application/services/clusterNamespace/ClusterNamespaceService'
import { ResourceWatchService } from '@/application/services/resourceWatch/ResourceWatchService'
import type { TResourceWatchHandlers } from '@/application/services/resourceWatch/types/TResourceWatchHandlers'
import { KubeClusterCatalog } from '@/domain/models/kube'
import { EntityRepoProvider } from '@/infrastructure/entityRepo/EntityRepoProvider'
import { KubeContextProvider } from '@/infrastructure/entityRepo/kube/KubeContextProvider'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { KubeHealthMonitor } from '@/infrastructure/kube/KubeHealthMonitor'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'
import { MemoryFileTransport } from '../../support/MemoryFileTransport'

const SELECTIONS_FILE = 'userdata:clusters/namespaces.json'
const runtime = { isAvailable: () => true } as WailsRuntimeService

let transport: MemoryFileTransport
let contexts: KubeContextProvider
let connections: ClusterConnectionService
let watchService: { start: Mock; stop: Mock }
let service: ClusterNamespaceService

const handlers: TResourceWatchHandlers = {
    onChanges: () => {},
    onResync: () => {},
    onStale: () => {},
}

const namespaceList = (...names: string[]): string => JSON.stringify({
    kind: 'NamespaceList',
    apiVersion: 'v1',
    metadata: { resourceVersion: '4242' },
    items: names.map(name => ({
        apiVersion: 'v1',
        kind: 'Namespace',
        metadata: { uid: `uid-${name}`, name },
        status: { phase: 'Active' },
    })),
})

describe('ClusterNamespaceService', () => {
    beforeEach(() => {
        send.mockReset()
        transport = new MemoryFileTransport()
        contexts = new KubeContextProvider(runtime, new KubeHealthMonitor(new EventBus()))
        connections = {
            context: (clusterId: string) => contexts.context(clusterId, `session-${clusterId}`),
        } as unknown as ClusterConnectionService
        watchService = { start: vi.fn(), stop: vi.fn() }
        service = new ClusterNamespaceService(
            new EntityRepoProvider(transport as unknown as FileSystemTransport),
            connections,
            watchService as unknown as ResourceWatchService,
        )
    })

    describe('the remembered selection', () => {
        it('is empty until something is chosen', async () => {
            await expect(service.getSelection('prod')).resolves.toEqual([])
            await expect(service.getSelections()).resolves.toEqual({})
        })

        it('lands in the user profile, not beside the binary', async () => {
            await service.setSelection('prod', ['payments'])

            expect([...transport.files.keys()]).toEqual([SELECTIONS_FILE])
        })

        it('is sorted and free of blanks and repeats', async () => {
            const stored = await service.setSelection('prod', ['web', ' api ', 'api', '', '  ', 'db'])

            expect(stored).toEqual(['api', 'db', 'web'])
            await expect(service.getSelection('prod')).resolves.toEqual(['api', 'db', 'web'])
        })

        it('replaces a selection rather than adding a second record', async () => {
            await service.setSelection('prod', ['api'])
            await service.setSelection('prod', ['db'])

            expect(transport.read(SELECTIONS_FILE)).toHaveLength(1)
            await expect(service.getSelection('prod')).resolves.toEqual(['db'])
        })

        it('keeps one cluster out of another cluster\'s scope', async () => {
            await service.setSelection('prod', ['payments'])
            await service.setSelection('lab', ['sandbox'])

            await expect(service.getSelections()).resolves.toEqual({
                prod: ['payments'],
                lab: ['sandbox'],
            })
        })

        it('choosing nothing drops the record instead of storing an empty one', async () => {
            await service.setSelection('prod', ['payments'])

            await expect(service.setSelection('prod', [])).resolves.toEqual([])

            expect(transport.read(SELECTIONS_FILE)).toEqual([])
        })

        it('clearing a cluster that chose nothing is not an error', async () => {
            await expect(service.clearSelection('prod')).resolves.toBeUndefined()
        })
    })

    describe('the namespaces a cluster serves', () => {
        it('asks only that cluster and returns the names sorted', async () => {
            send.mockResolvedValue({
                success: true,
                status: 200,
                headers: {},
                body: namespaceList('kube-system', 'default', 'payments'),
                error: '',
            })

            const catalog = await service.list('prod')

            expect(catalog.names).toEqual(['default', 'kube-system', 'payments'])
            expect(send.mock.calls[0][0].sessionId).toBe('session-prod')
            expect(send.mock.calls[0][0].path).toContain('/api/v1/namespaces')
        })

        it('asks the cluster for the active ones rather than filtering afterwards', async () => {
            send.mockResolvedValue({ success: true, status: 200, headers: {}, body: namespaceList('default'), error: '' })

            await service.list('prod')

            expect(decodeURIComponent(send.mock.calls[0][0].path)).toContain('status.phase=Active')
        })

        it('answers nothing when the cluster lists nothing', async () => {
            send.mockResolvedValue({ success: true, status: 200, headers: {}, body: namespaceList(), error: '' })

            await expect(service.list('prod')).resolves.toMatchObject({ names: [] })
        })

        it('reports the version the list was read at, so a watch can resume from it', async () => {
            send.mockResolvedValue({ success: true, status: 200, headers: {}, body: namespaceList('default'), error: '' })

            await expect(service.list('prod')).resolves.toMatchObject({ resourceVersion: '4242' })
        })
    })

    describe('the live stream behind the picker', () => {
        it('watches namespaces under a scope of its own, from the version it was given', async () => {
            await service.watch('prod', '4242', handlers)

            expect(watchService.start).toHaveBeenCalledTimes(1)
            const request = watchService.start.mock.calls[0][0]
            expect(request.clusterId).toBe('prod')
            expect(request.kind.registryKey).toBe(KubeClusterCatalog.namespacesKey)
            expect(request.cursors).toEqual([{ namespace: '', resourceVersion: '4242' }])
            expect(request.scope).not.toBe('')
        })

        it('opens no stream without a version to resume from', async () => {
            await service.watch('prod', '', handlers)

            expect(watchService.start).not.toHaveBeenCalled()
        })

        it('closes the stream it opened, and only that scope', async () => {
            await service.watch('prod', '4242', handlers)
            await service.unwatch('prod')

            expect(watchService.stop).toHaveBeenCalledTimes(1)
            expect(watchService.stop.mock.calls[0][0]).toBe('prod')
            expect(watchService.stop.mock.calls[0][2]).toBe(watchService.start.mock.calls[0][0].scope)
        })
    })
})
