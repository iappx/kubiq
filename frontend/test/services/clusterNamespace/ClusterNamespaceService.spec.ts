import { beforeEach, describe, expect, it, vi } from 'vitest'

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
import { EntityRepoProvider } from '@/infrastructure/entityRepo/EntityRepoProvider'
import { KubeContextProvider } from '@/infrastructure/entityRepo/kube/KubeContextProvider'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'
import { MemoryFileTransport } from '../../support/MemoryFileTransport'

const SELECTIONS_FILE = 'userdata:clusters/namespaces.json'
const runtime = { isAvailable: () => true } as WailsRuntimeService

let transport: MemoryFileTransport
let contexts: KubeContextProvider
let connections: ClusterConnectionService
let service: ClusterNamespaceService

const namespaceList = (...names: string[]): string => JSON.stringify({
    kind: 'NamespaceList',
    apiVersion: 'v1',
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
        contexts = new KubeContextProvider(runtime)
        connections = {
            context: (clusterId: string) => contexts.context(clusterId, `session-${clusterId}`),
        } as unknown as ClusterConnectionService
        service = new ClusterNamespaceService(
            new EntityRepoProvider(transport as unknown as FileSystemTransport),
            connections,
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

            await expect(service.listAvailable('prod')).resolves.toEqual(['default', 'kube-system', 'payments'])

            expect(send.mock.calls[0][0].sessionId).toBe('session-prod')
            expect(send.mock.calls[0][0].path).toContain('/api/v1/namespaces')
        })

        it('asks the cluster for the active ones rather than filtering afterwards', async () => {
            send.mockResolvedValue({ success: true, status: 200, headers: {}, body: namespaceList('default'), error: '' })

            await service.listAvailable('prod')

            expect(decodeURIComponent(send.mock.calls[0][0].path)).toContain('status.phase=Active')
        })

        it('answers nothing when the cluster lists nothing', async () => {
            send.mockResolvedValue({ success: true, status: 200, headers: {}, body: namespaceList(), error: '' })

            await expect(service.listAvailable('prod')).resolves.toEqual([])
        })
    })
})
