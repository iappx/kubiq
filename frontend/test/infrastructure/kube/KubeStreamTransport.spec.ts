import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

// The generated Wails bindings are the only thing stubbed here; the runtime that
// carries the stream events is the real one.
const startStream = vi.fn()
const stopStream = vi.fn()

vi.mock('../../../bindings/iappx_k8s_admin/core/services/kube', () => ({
    KubeService: {
        StartStream: (...args: unknown[]) => startStream(...args),
        StopStream: (...args: unknown[]) => stopStream(...args),
    },
    StreamRequest: class {
        constructor(source: Record<string, unknown>) {
            Object.assign(this, source)
        }
    },
    Request: class {},
}))

import { ApiError } from '@/domain/errors/ApiError'
import { KubeStreamTransport } from '@/infrastructure/entityRepo/kube/transport/KubeStreamTransport'
import { KubeWatchSubscription } from '@/infrastructure/entityRepo/kube/transport/KubeWatchSubscription'
import type { TKubeWatchEvent } from '@/infrastructure/entityRepo/kube/transport/types/TKubeWatchEvent'
import type { TKubeWatchStatus } from '@/infrastructure/entityRepo/kube/transport/types/TKubeWatchStatus'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

const transport = new KubeStreamTransport('session-1', container.resolve(WailsRuntimeService))

const recorder = () => {
    const events: TKubeWatchEvent[] = []
    const closes: TKubeWatchStatus[] = []
    return {
        events,
        closes,
        onEvent: (event: TKubeWatchEvent) => events.push(event),
        onClose: (status: TKubeWatchStatus) => closes.push(status),
    }
}

const emit = (name: string, data: unknown): void => {
    (window as any)._wails.dispatchWailsEvent({ name, data })
}

const chunk = (streamId: string, line: unknown): void => {
    emit(KubeWatchSubscription.chunkEvent, { streamId, data: typeof line === 'string' ? line : JSON.stringify(line) })
}

const pod = (name: string): Record<string, unknown> => ({ kind: 'Pod', metadata: { name, uid: `uid-${name}` } })

describe('KubeStreamTransport', () => {
    beforeEach(() => {
        startStream.mockReset()
        stopStream.mockReset()
        startStream.mockResolvedValue({ success: true, streamId: 'stream-1', error: '' })
        stopStream.mockResolvedValue({ success: true, error: '' })
        ;(window as any).chrome = { webview: { postMessage: () => undefined } }
    })

    it('asks the API server to watch from a resource version, bookmarks included', async () => {
        await transport.watch({ path: '/api/v1/namespaces/dev/pods', resourceVersion: '77' }, recorder())

        expect(startStream.mock.calls[0][0]).toMatchObject({
            sessionId: 'session-1',
            method: 'GET',
            mode: 'lines',
            path: '/api/v1/namespaces/dev/pods?watch=true&allowWatchBookmarks=true&resourceVersion=77',
        })
    })

    it('carries the selectors of the list into the watch', async () => {
        await transport.watch(
            { path: '/api/v1/pods', labelSelector: 'app=web', fieldSelector: 'spec.nodeName=node-a' },
            recorder(),
        )

        expect(decodeURIComponent(startStream.mock.calls[0][0].path))
            .toBe('/api/v1/pods?watch=true&allowWatchBookmarks=true&labelSelector=app=web&fieldSelector=spec.nodeName=node-a')
    })

    it('reads the lines of the stream as changes', async () => {
        const handler = recorder()
        await transport.watch({ path: '/api/v1/pods' }, handler)

        chunk('stream-1', { type: 'ADDED', object: pod('web-1') })
        chunk('stream-1', { type: 'MODIFIED', object: pod('web-1') })
        chunk('stream-1', { type: 'DELETED', object: pod('web-1') })

        expect(handler.events.map(event => event.type)).toEqual(['added', 'modified', 'deleted'])
        expect(handler.events[0].object).toEqual(pod('web-1'))
    })

    it('passes a bookmark on, so the caller can keep its resource version', async () => {
        const handler = recorder()
        await transport.watch({ path: '/api/v1/pods' }, handler)

        chunk('stream-1', { type: 'BOOKMARK', object: { kind: 'Pod', metadata: { resourceVersion: '120' } } })

        expect(handler.events[0].type).toBe('bookmark')
        expect((handler.events[0].object?.metadata as Record<string, unknown>).resourceVersion).toBe('120')
    })

    it('reports a gone resource version as expired rather than as a failure', async () => {
        const handler = recorder()
        await transport.watch({ path: '/api/v1/pods' }, handler)

        chunk('stream-1', {
            type: 'ERROR',
            object: { kind: 'Status', status: 'Failure', message: 'too old resource version: 77 (120)', reason: 'Expired', code: 410 },
        })

        expect(handler.events[0].type).toBe('expired')
        expect(handler.events[0].message).toBe('too old resource version: 77 (120)')
    })

    it('reports any other error frame as an error', async () => {
        const handler = recorder()
        await transport.watch({ path: '/api/v1/pods' }, handler)

        chunk('stream-1', {
            type: 'ERROR',
            object: { kind: 'Status', status: 'Failure', message: 'forbidden', reason: 'Forbidden', code: 403 },
        })

        expect(handler.events[0].type).toBe('error')
        expect(handler.events[0].message).toBe('forbidden')
    })

    it('reads a line that is not a watch frame as an error instead of failing', async () => {
        const handler = recorder()
        await transport.watch({ path: '/api/v1/pods' }, handler)

        chunk('stream-1', 'not json at all')

        expect(handler.events[0].type).toBe('error')
        expect(handler.events[0].details).toBe('not json at all')
    })

    it('ignores the lines of another stream', async () => {
        const handler = recorder()
        await transport.watch({ path: '/api/v1/pods' }, handler)

        chunk('stream-2', { type: 'ADDED', object: pod('web-1') })

        expect(handler.events).toHaveLength(0)
    })

    it('keeps the lines that arrive before the stream id does', async () => {
        const handler = recorder()
        let started: (result: unknown) => void = () => undefined
        startStream.mockReturnValue(new Promise((resolve) => {
            started = resolve
        }))

        const pending = transport.watch({ path: '/api/v1/pods' }, handler)
        chunk('stream-1', { type: 'ADDED', object: pod('web-1') })
        started({ success: true, streamId: 'stream-1', error: '' })
        await pending

        expect(handler.events.map(event => event.type)).toEqual(['added'])
    })

    it('reports a broken stream and closes it', async () => {
        const handler = recorder()
        await transport.watch({ path: '/api/v1/pods' }, handler)

        emit(KubeWatchSubscription.errorEvent, { streamId: 'stream-1', error: 'unexpected EOF' })
        emit(KubeWatchSubscription.closeEvent, { streamId: 'stream-1', status: 'error' })

        expect(handler.events[0]).toEqual({
            type: 'error',
            message: KubeWatchSubscription.interrupted,
            details: 'unexpected EOF',
        })
        expect(handler.closes).toEqual(['error'])
    })

    it('stops listening once the stream is closed', async () => {
        const handler = recorder()
        await transport.watch({ path: '/api/v1/pods' }, handler)

        emit(KubeWatchSubscription.closeEvent, { streamId: 'stream-1', status: 'eof' })
        chunk('stream-1', { type: 'ADDED', object: pod('web-1') })

        expect(handler.closes).toEqual(['eof'])
        expect(handler.events).toHaveLength(0)
    })

    it('stops the stream on the Go side and closes exactly once', async () => {
        const handler = recorder()
        const subscription = await transport.watch({ path: '/api/v1/pods' }, handler)

        await subscription.stop()
        await subscription.stop()
        chunk('stream-1', { type: 'ADDED', object: pod('web-1') })

        expect(stopStream).toHaveBeenCalledTimes(1)
        expect(stopStream.mock.calls[0][0]).toBe('stream-1')
        expect(handler.closes).toEqual(['stopped'])
        expect(handler.events).toHaveLength(0)
    })

    it('raises an ApiError when the stream cannot be stopped, and stops listening anyway', async () => {
        const handler = recorder()
        const subscription = await transport.watch({ path: '/api/v1/pods' }, handler)
        stopStream.mockRejectedValue(new Error('binding is gone'))

        await expect(subscription.stop()).rejects.toThrow(ApiError)

        chunk('stream-1', { type: 'ADDED', object: pod('web-1') })
        expect(handler.events).toHaveLength(0)
        expect(handler.closes).toEqual(['stopped'])
    })

    it('raises an ApiError when the stream cannot be started', async () => {
        const handler = recorder()
        startStream.mockResolvedValue({ success: false, streamId: '', error: 'unknown session: session-1' })

        await expect(transport.watch({ path: '/api/v1/pods' }, handler)).rejects.toThrow(ApiError)

        chunk('stream-1', { type: 'ADDED', object: pod('web-1') })
        expect(handler.events).toHaveLength(0)
    })

    it('degrades quietly without the Wails runtime', async () => {
        delete (window as any).chrome
        const handler = recorder()

        const subscription = await transport.watch({ path: '/api/v1/pods' }, handler)
        await subscription.stop()

        expect(startStream).not.toHaveBeenCalled()
        expect(stopStream).not.toHaveBeenCalled()
        expect(subscription.id).toBe('')
    })
})
