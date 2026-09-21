import { beforeEach, describe, expect, it } from 'vitest'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeContextProvider } from '@/infrastructure/entityRepo/kube/KubeContextProvider'
import { KubeStatusReader } from '@/infrastructure/entityRepo/kube/transport/KubeStatusReader'
import { KubeObjectAdapter } from '@/infrastructure/kube/KubeObjectAdapter'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'

const transport = new MemoryKubeTransport()
const contexts = { request: () => transport } as unknown as KubeContextProvider

let adapter: KubeObjectAdapter

describe('KubeObjectAdapter', () => {
    beforeEach(() => {
        transport.reset()
        adapter = new KubeObjectAdapter(contexts)
    })

    it('hands back the object untouched, fields the entities do not model included', async () => {
        transport.answerWith({ apiVersion: 'v1', kind: 'Secret', stringData: { token: 'x' }, oddField: [1, 2] })

        const object = await adapter.read('prod', 'session-1', '/api/v1/namespaces/payments/secrets/api')

        expect(object).toEqual({ apiVersion: 'v1', kind: 'Secret', stringData: { token: 'x' }, oddField: [1, 2] })
    })

    it('asks for exactly the path it was given', async () => {
        transport.answerWith({})

        await adapter.read('prod', 'session-1', '/api/v1/nodes/node-a')

        expect(transport.last).toMatchObject({ method: 'GET', url: '/api/v1/nodes/node-a' })
    })

    it('reports an answer that is not an object as a business error', async () => {
        transport.answerWith([1, 2, 3])

        await expect(adapter.read('prod', 'session-1', '/api/v1/pods')).rejects.toBeInstanceOf(ApiError)
    })

    it('lets a refusal through rather than swallowing it like discovery does', async () => {
        transport.failWith(new ApiError('Denied', 'Forbidden', 403))

        await expect(adapter.read('prod', 'session-1', '/api/v1/pods/api-0')).rejects.toMatchObject({ status: 403 })
    })
})

describe('KubeStatusReader', () => {
    it('tells a version conflict from anything else by its status, never its text', () => {
        expect(KubeStatusReader.isConflict(new ApiError('anything at all', '', 409))).toBe(true)
        expect(KubeStatusReader.isConflict(new ApiError('The object has changed in the cluster', '', 422))).toBe(false)
    })

    it('tells a missing object from a refused one', () => {
        expect(KubeStatusReader.isMissing(new ApiError('', '', 404))).toBe(true)
        expect(KubeStatusReader.isForbidden(new ApiError('', '', 404))).toBe(false)
    })

    it('says nothing about an error that never reached a server', () => {
        expect(KubeStatusReader.isConflict(new Error('offline'))).toBe(false)
        expect(KubeStatusReader.isMissing(undefined)).toBe(false)
    })

    it('tells a rate limit and an unavailable api from the rest', () => {
        expect(KubeStatusReader.isThrottled(new ApiError('', '', 429))).toBe(true)
        expect(KubeStatusReader.isUnavailable(new ApiError('', '', 503))).toBe(true)
        expect(KubeStatusReader.isUnauthorized(new ApiError('', '', 401))).toBe(true)
    })

    it('calls a kind the cluster does not serve absent, whether it says 404 or 503', () => {
        expect(KubeStatusReader.isAbsent(new ApiError('', '', 404))).toBe(true)
        expect(KubeStatusReader.isAbsent(new ApiError('', '', 503))).toBe(true)
        expect(KubeStatusReader.isAbsent(new ApiError('', '', 403))).toBe(false)
    })

    it('reads the kind back off an error that already travelled', () => {
        expect(KubeStatusReader.kindOf(new ApiError('', '', 403))).toBe('forbidden')
        expect(KubeStatusReader.kindOf(new ApiError('', '', 429))).toBe('throttled')
    })

    it('keeps the transport detail, so a timeout is not mistaken for an outage', () => {
        expect(KubeStatusReader.kindOf(new ApiError('', 'context deadline exceeded', 0))).toBe('timeout')
        expect(KubeStatusReader.kindOf(new ApiError('', 'connection refused', 0))).toBe('unreachable')
    })

    it('claims no kind for an error that is not ours', () => {
        expect(KubeStatusReader.kindOf(new Error('boom'))).toBe('unknown')
        expect(KubeStatusReader.kindOf(new ApiError('no status'))).toBe('unknown')
        expect(KubeStatusReader.kindOf(undefined)).toBe('unknown')
    })
})
