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

import { KubeContextProvider } from '@/infrastructure/entityRepo/kube/KubeContextProvider'
import { KubeVersionAdapter } from '@/infrastructure/kube/KubeVersionAdapter'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { KubeHealthMonitor } from '@/infrastructure/kube/KubeHealthMonitor'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

const runtime = { isAvailable: () => true } as WailsRuntimeService

let contexts: KubeContextProvider
let adapter: KubeVersionAdapter

describe('KubeVersionAdapter', () => {
    beforeEach(() => {
        send.mockReset()
        contexts = new KubeContextProvider(runtime, new KubeHealthMonitor(new EventBus()))
        adapter = new KubeVersionAdapter(contexts)
    })

    it('asks /version on the session of that cluster', async () => {
        send.mockResolvedValue({
            success: true,
            status: 200,
            headers: {},
            body: JSON.stringify({ major: '1', minor: '32', gitVersion: 'v1.32.0' }),
            error: '',
        })

        const version = await adapter.read('prod', 'session-prod')

        expect(version.text).toBe('v1.32.0')
        expect(send.mock.calls[0][0].path).toBe(KubeVersionAdapter.path)
        expect(send.mock.calls[0][0].sessionId).toBe('session-prod')
        expect(send.mock.calls[0][0].method).toBe('GET')
    })

    it('answers unknown rather than failing the connection when the cluster refuses', async () => {
        send.mockResolvedValue({ success: false, status: 403, headers: {}, body: '', error: 'forbidden' })

        const version = await adapter.read('prod', 'session-prod')

        expect(version.isKnown).toBe(false)
    })

    it('answers unknown when the bridge itself breaks', async () => {
        send.mockRejectedValue(new Error('the bridge is gone'))

        await expect(adapter.read('prod', 'session-prod')).resolves.toMatchObject({ major: 0, minor: 0 })
    })

    it('answers unknown when the body is not a version document', async () => {
        send.mockResolvedValue({ success: true, status: 200, headers: {}, body: '"nope"', error: '' })

        await expect(adapter.read('prod', 'session-prod')).resolves.toMatchObject({ major: 0 })
    })

    it('reads each cluster through its own transport', async () => {
        send.mockResolvedValue({
            success: true,
            status: 200,
            headers: {},
            body: JSON.stringify({ major: '1', minor: '31' }),
            error: '',
        })

        await adapter.read('prod', 'session-prod')
        await adapter.read('lab', 'session-lab')

        expect(send.mock.calls.map(call => call[0].sessionId)).toEqual(['session-prod', 'session-lab'])
    })
})
