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

import { ApiError } from '@/domain/errors/ApiError'
import { KubeFailureCatalog } from '@/domain/models/kube'
import { KubeStatusReader } from '@/infrastructure/entityRepo/kube/transport/KubeStatusReader'
import { KubeTransport } from '@/infrastructure/entityRepo/kube/transport/KubeTransport'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

const transport = new KubeTransport('session-1', container.resolve(WailsRuntimeService))

const answer = (fields: Record<string, unknown>): void => {
    send.mockResolvedValue({ success: true, status: 200, headers: {}, body: '', error: '', ...fields })
}

const failure = async (action: () => Promise<unknown>): Promise<ApiError> => {
    let caught: unknown
    try {
        await action()
    } catch (err) {
        caught = err
    }
    expect(caught).toBeInstanceOf(ApiError)
    return caught as ApiError
}

const status = (code: number, message: string, reason: string): string => JSON.stringify({
    kind: 'Status',
    apiVersion: 'v1',
    status: 'Failure',
    message,
    reason,
    code,
})

describe('KubeTransport', () => {
    beforeEach(() => {
        send.mockReset()
        ;(window as any).chrome = { webview: { postMessage: () => undefined } }
    })

    it('reads nothing when the Wails runtime is absent', async () => {
        delete (window as any).chrome

        await expect(transport.send({ method: 'GET', url: '/api/v1/pods' })).resolves.toBeNull()
        expect(send).not.toHaveBeenCalled()
    })

    it('hands the query string to the Go client as part of the path', async () => {
        answer({ body: '{"items":[]}' })

        await transport.send({ method: 'GET', url: '/api/v1/pods', query: { labelSelector: 'app=web', limit: 50 } })

        expect(send.mock.calls[0][0]).toMatchObject({
            sessionId: 'session-1',
            method: 'GET',
            path: '/api/v1/pods?labelSelector=app%3Dweb&limit=50',
        })
    })

    it('parses the body and reports the status back to the dialect', async () => {
        answer({ status: 201, headers: { 'Content-Type': 'application/json' }, body: '{"kind":"Pod"}' })

        const response = await transport.send<{ status: number, headers: Record<string, string>, data: unknown }>({
            method: 'POST',
            url: '/api/v1/namespaces/dev/pods',
            body: { kind: 'Pod' },
        })

        expect(response.status).toBe(201)
        expect(response.headers['content-type']).toBe('application/json')
        expect(response.data).toEqual({ kind: 'Pod' })
    })

    it('serialises the body and declares json when nothing else is declared', async () => {
        answer({ body: '{}' })

        await transport.send({ method: 'POST', url: '/api/v1/namespaces/dev/pods', body: { kind: 'Pod' } })

        expect(send.mock.calls[0][0]).toMatchObject({
            body: '{"kind":"Pod"}',
            headers: { 'content-type': 'application/json' },
        })
    })

    it('leaves a declared content type alone', async () => {
        answer({ body: '{}' })

        await transport.send({
            method: 'PATCH',
            url: '/api/v1/namespaces/dev/pods/web-1',
            headers: { 'content-type': 'application/merge-patch+json' },
            body: { spec: {} },
        })

        expect(send.mock.calls[0][0].headers).toEqual({ 'content-type': 'application/merge-patch+json' })
    })

    it('turns a refusal into an ApiError the user can read', async () => {
        answer({
            success: false,
            status: 403,
            body: status(403, 'pods is forbidden: User "dev" cannot list resource "pods"', 'Forbidden'),
        })

        const error = await failure(() => transport.send({ method: 'GET', url: '/api/v1/pods' }))

        expect(error.message).toBe('pods is forbidden: User "dev" cannot list resource "pods"')
        expect(error.details).toBe('Forbidden')
    })

    it('writes the text itself when the cluster sends no Status object', async () => {
        answer({ success: false, status: 403, body: '' })

        const error = await failure(() => transport.send({ method: 'GET', url: '/api/v1/pods' }))

        expect(error.message).toBe(KubeStatusReader.describe(403))
    })

    it('reports a missing object', async () => {
        answer({ success: false, status: 404, body: status(404, 'pods "web-1" not found', 'NotFound') })

        const error = await failure(() => transport.send({ method: 'GET', url: '/api/v1/namespaces/dev/pods/web-1' }))

        expect(error.message).toBe('pods "web-1" not found')
    })

    it('reports a version conflict', async () => {
        answer({ success: false, status: 409, body: '' })

        const error = await failure(() => transport.send({ method: 'PUT', url: '/api/v1/namespaces/dev/pods/web-1' }))

        expect(error.message).toBe('The object has changed in the cluster since it was loaded')
    })

    it('reports a cluster it could not reach at all', async () => {
        answer({ success: false, status: 0, body: '', error: 'dial tcp 10.0.0.1:6443: connect: timed out' })

        const error = await failure(() => transport.send({ method: 'GET', url: '/api/v1/pods' }))

        expect(error.message).toBe(KubeStatusReader.unreachable)
        expect(error.details).toBe('dial tcp 10.0.0.1:6443: connect: timed out')
    })

    it('raises an ApiError when the binding call rejects', async () => {
        send.mockRejectedValue(new Error('binding is gone'))

        const error = await failure(() => transport.send({ method: 'GET', url: '/api/v1/pods' }))

        expect(error.message).toBe(KubeStatusReader.unreachable)
        expect(error.details).toBe('binding is gone')
    })

    it('writes its own text for a rejected credential, because the cluster only says Unauthorized', async () => {
        answer({ success: false, status: 401, body: status(401, 'Unauthorized', 'Unauthorized') })

        const error = await failure(() => transport.send({ method: 'GET', url: '/api/v1/pods' }))

        expect(error.message).toBe(KubeFailureCatalog.message('unauthorized'))
        expect(error.message).toContain('Reconnect')
        expect(error.details).toBe('Unauthorized')
    })

    it('names a rate limit as one', async () => {
        answer({ success: false, status: 429, body: '' })

        const error = await failure(() => transport.send({ method: 'GET', url: '/api/v1/pods' }))

        expect(error.message).toBe(KubeFailureCatalog.message('throttled'))
        expect(error.status).toBe(429)
    })

    it('tells an unavailable api apart from an internal error', async () => {
        answer({ success: false, status: 503, body: '' })
        const unavailable = await failure(() => transport.send({ method: 'GET', url: '/apis/metrics.k8s.io/v1beta1/pods' }))

        answer({ success: false, status: 500, body: '' })
        const broken = await failure(() => transport.send({ method: 'GET', url: '/api/v1/pods' }))

        expect(unavailable.message).toBe(KubeFailureCatalog.message('unavailable'))
        expect(broken.message).toBe(KubeFailureCatalog.message('serverError'))
    })

    it('tells a timeout apart from a server it never reached', async () => {
        answer({ success: false, status: 0, body: '', error: 'Get "https://api:6443/api/v1/pods": context deadline exceeded' })

        const error = await failure(() => transport.send({ method: 'GET', url: '/api/v1/pods' }))

        expect(error.message).toBe(KubeFailureCatalog.message('timeout'))
    })

    it('names a certificate it could not verify', async () => {
        answer({
            success: false,
            status: 0,
            body: '',
            error: 'tls: failed to verify certificate: x509: certificate signed by unknown authority',
        })

        const error = await failure(() => transport.send({ method: 'GET', url: '/api/v1/pods' }))

        expect(error.message).toBe(KubeFailureCatalog.message('tls'))
    })

    it('says the connection is closed when the Go side no longer holds the session', async () => {
        answer({ success: false, status: 0, body: '', error: 'unknown session: session-1' })

        const error = await failure(() => transport.send({ method: 'GET', url: '/api/v1/pods' }))

        expect(error.message).toBe(KubeFailureCatalog.message('disconnected'))
    })

    it('tells the probe how every request ended', async () => {
        const reported: string[] = []
        const probed = new KubeTransport('session-1', container.resolve(WailsRuntimeService), {
            succeeded: () => reported.push('ok'),
            failed: (err: unknown) => reported.push(`failed:${ApiError.statusOf(err)}`),
        })

        answer({})
        await probed.send({ method: 'GET', url: '/api/v1/pods' })

        answer({ success: false, status: 401, body: '' })
        await failure(() => probed.send({ method: 'GET', url: '/api/v1/pods' }))

        expect(reported).toEqual(['ok', 'failed:401'])
    })

    it('tells the probe nothing when there is no runtime to ask', async () => {
        const reported: string[] = []
        const offline = new KubeTransport('session-1', { isAvailable: () => false } as WailsRuntimeService, {
            succeeded: () => reported.push('ok'),
            failed: () => reported.push('failed'),
        })

        await offline.send({ method: 'GET', url: '/api/v1/pods' })

        expect(reported).toEqual([])
    })
})
