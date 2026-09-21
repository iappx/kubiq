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
import { KubeDiscoveryAdapter } from '@/infrastructure/kube/KubeDiscoveryAdapter'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

const runtime = { isAvailable: () => true } as WailsRuntimeService

const ok = (body: unknown) => ({ success: true, status: 200, headers: {}, body: JSON.stringify(body), error: '' })

const answer = (byPath: Record<string, unknown>) => {
    send.mockImplementation((request: { path: string }) => {
        const body = byPath[request.path]
        return Promise.resolve(body === undefined
            ? { success: false, status: 404, headers: {}, body: '', error: 'not found' }
            : ok(body))
    })
}

let adapter: KubeDiscoveryAdapter

const paths = () => send.mock.calls.map(call => call[0].path)

describe('KubeDiscoveryAdapter', () => {
    beforeEach(() => {
        send.mockReset()
        adapter = new KubeDiscoveryAdapter(new KubeContextProvider(runtime))
    })

    it('asks the cluster what it serves before asking any group about it', async () => {
        answer({ '/api': { versions: ['v1'] }, '/apis': { groups: [] }, '/api/v1': { groupVersion: 'v1', resources: [] } })

        await adapter.read('prod', 'session-prod')

        expect(paths().slice(0, 2).sort()).toEqual(['/api', '/apis'])
    })

    it('asks each group only at the version the cluster prefers', async () => {
        answer({
            '/api': { versions: ['v1'] },
            '/apis': {
                groups: [{
                    name: 'apps',
                    versions: [{ version: 'v1' }, { version: 'v1beta1' }],
                    preferredVersion: { version: 'v1' },
                }],
            },
            '/api/v1': { groupVersion: 'v1', resources: [] },
            '/apis/apps/v1': { groupVersion: 'apps/v1', resources: [] },
        })

        await adapter.read('prod', 'session-prod')

        expect(paths()).toContain('/apis/apps/v1')
        expect(paths()).not.toContain('/apis/apps/v1beta1')
    })

    it('hands the resource lists over as discovery input', async () => {
        answer({
            '/api': { versions: ['v1'] },
            '/apis': { groups: [] },
            '/api/v1': { groupVersion: 'v1', resources: [{ name: 'pods', kind: 'Pod', verbs: ['list'] }] },
        })

        const input = await adapter.read('prod', 'session-prod')

        expect(input.resourceLists).toEqual([{ groupVersion: 'v1', resources: [{ name: 'pods', kind: 'Pod', verbs: ['list'] }] }])
    })

    it('drops a group it was refused and keeps the rest', async () => {
        answer({
            '/api': { versions: ['v1'] },
            '/apis': {
                groups: [
                    { name: 'apps', preferredVersion: { version: 'v1' }, versions: [{ version: 'v1' }] },
                    { name: 'secret.io', preferredVersion: { version: 'v1' }, versions: [{ version: 'v1' }] },
                ],
            },
            '/api/v1': { groupVersion: 'v1', resources: [] },
            '/apis/apps/v1': { groupVersion: 'apps/v1', resources: [] },
        })

        const input = await adapter.read('prod', 'session-prod')

        expect(input.resourceLists?.map(list => list.groupVersion).sort()).toEqual(['apps/v1', 'v1'])
    })

    it('answers with an empty discovery rather than throwing when the cluster says nothing', async () => {
        send.mockResolvedValue({ success: false, status: 403, headers: {}, body: '', error: 'forbidden' })

        const input = await adapter.read('prod', 'session-prod')

        expect(input).toEqual({ coreVersions: undefined, groups: undefined, resourceLists: [] })
    })

    it('reads each cluster on its own session', async () => {
        answer({ '/api': { versions: ['v1'] }, '/apis': { groups: [] }, '/api/v1': { groupVersion: 'v1', resources: [] } })

        await adapter.read('prod', 'session-prod')
        await adapter.read('lab', 'session-lab')

        expect(new Set(send.mock.calls.map(call => call[0].sessionId))).toEqual(new Set(['session-prod', 'session-lab']))
    })

    it('spells the core group path without the group segment', () => {
        expect(KubeDiscoveryAdapter.basePath('', 'v1')).toBe('/api/v1')
        expect(KubeDiscoveryAdapter.basePath('apps', 'v1')).toBe('/apis/apps/v1')
    })
})
