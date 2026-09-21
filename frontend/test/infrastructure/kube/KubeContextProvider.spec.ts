import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

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

import { KubeResourceKind, KubeResourceRegistry } from '@/domain/models/kube'
import { KubeContextProvider } from '@/infrastructure/entityRepo/kube/KubeContextProvider'
import { KubeQueryMeta } from '@/infrastructure/entityRepo/kube/KubeQueryMeta'

const provider = container.resolve(KubeContextProvider)

const pods = KubeResourceRegistry.find('', 'pods') as KubeResourceKind

describe('KubeContextProvider', () => {
    beforeEach(() => {
        provider.releaseAll()
        send.mockReset()
        send.mockResolvedValue({ success: true, status: 200, headers: {}, body: '{"items":[]}', error: '' })
        ;(window as any).chrome = { webview: { postMessage: () => undefined } }
    })

    it('builds the context of a cluster once', () => {
        expect(provider.context('cluster-a', 'session-1')).toBe(provider.context('cluster-a', 'session-1'))
        expect(provider.stream('cluster-a', 'session-1')).toBe(provider.stream('cluster-a', 'session-1'))
    })

    it('gives every cluster a context of its own', () => {
        expect(provider.context('cluster-a', 'session-1')).not.toBe(provider.context('cluster-b', 'session-2'))
    })

    it('sends the requests of a cluster to the session of that cluster', async () => {
        const list = (cluster: string, session: string): Promise<unknown> => provider
            .context(cluster, session)
            .resources
            .withMeta(KubeQueryMeta.forKind(pods))
            .getAll()

        await list('cluster-a', 'session-1')
        await list('cluster-b', 'session-2')

        expect(send.mock.calls.map(call => call[0].sessionId)).toEqual(['session-1', 'session-2'])
        expect(send.mock.calls[0][0].path).toBe('/api/v1/pods')
    })

    it('rebuilds the context when the cluster is reconnected under a new session', async () => {
        const first = provider.context('cluster-a', 'session-1')
        const second = provider.context('cluster-a', 'session-2')

        expect(second).not.toBe(first)
        expect(provider.stream('cluster-a', 'session-2').session).toBe('session-2')

        await second.resources.withMeta(KubeQueryMeta.forKind(pods)).getAll()

        expect(send.mock.calls[0][0].sessionId).toBe('session-2')
    })

    it('forgets a cluster that was disconnected', () => {
        const before = provider.context('cluster-a', 'session-1')
        provider.release('cluster-a')

        expect(provider.has('cluster-a')).toBe(false)
        expect(provider.context('cluster-a', 'session-1')).not.toBe(before)
    })
})
