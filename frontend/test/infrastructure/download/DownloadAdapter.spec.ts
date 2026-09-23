import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const start = vi.fn()
const cancel = vi.fn()

vi.mock('../../../bindings/iappx_k8s_admin/core/services/download', () => ({
    DownloadService: {
        Start: (...args: unknown[]) => start(...args),
        Cancel: (...args: unknown[]) => cancel(...args),
    },
}))

vi.mock('../../../bindings/iappx_k8s_admin/core/services/download/models', () => ({
    DownloadSpec: class {
        constructor(source: Record<string, unknown>) {
            Object.assign(this, source)
        }
    },
}))

import { ApiError } from '@/domain/errors/ApiError'
import { DownloadAdapter } from '@/infrastructure/download/DownloadAdapter'
import { DownloadRun } from '@/infrastructure/download/DownloadRun'
import type { IDownloadSink } from '@/infrastructure/download/types/IDownloadSink'
import { MemoryDownloadHost } from '../../support/MemoryDownloadHost'

const host = new MemoryDownloadHost()
const adapter = container.resolve(DownloadAdapter)

const sink = () => {
    const ticks: [number, number][] = []
    const handler: IDownloadSink = { onProgress: (received, total) => ticks.push([received, total]) }

    return { ticks, handler }
}

describe('DownloadAdapter', () => {
    beforeEach(() => {
        host.reset()
        start.mockReset()
        cancel.mockReset()
        start.mockImplementation((spec: any) => host.start(spec))
        cancel.mockImplementation((id: string) => host.cancel(id))
        ;(window as any).chrome = { webview: { postMessage: () => undefined } }
    })

    it('hands the url, the target path and the headers to the Go side', async () => {
        const { handler } = sink()

        const run = await adapter.start(
            { url: 'https://example.test/file', path: 'userdata:updates/file', headers: { accept: 'application/octet-stream' } },
            handler,
        )
        await run.outcome

        expect(host.started[0]).toEqual({
            url: 'https://example.test/file',
            path: 'userdata:updates/file',
            headers: { accept: 'application/octet-stream' },
        })
    })

    it('reports progress and resolves with the size and digest of the finished file', async () => {
        host.script({ body: 'installer-bytes', progress: [5, 10] })
        const { ticks, handler } = sink()

        const run = await adapter.start({ url: 'u', path: 'p' }, handler)
        const outcome = await run.outcome

        expect(ticks).toEqual([[5, 15], [10, 15]])
        expect(outcome).toEqual({
            cancelled: false,
            path: 'p',
            size: 15,
            sha256: await MemoryDownloadHost.sha256Of('installer-bytes'),
        })
        expect(run.isFinished).toBe(true)
    })

    it('rejects with an ApiError carrying the Go side reason when the download fails', async () => {
        host.script({ error: 'server answered 404 Not Found' })

        const run = await adapter.start({ url: 'u', path: 'p' }, sink().handler)
        const failure = await run.outcome.catch(err => err)

        expect(failure).toBeInstanceOf(ApiError)
        expect(failure.message).toBe(DownloadRun.failureMessage)
        expect(failure.details).toBe('server answered 404 Not Found')
    })

    it('rejects when the Go side refuses to start', async () => {
        host.script({ refuse: 'url is empty' })

        const run = await adapter.start({ url: '', path: 'p' }, sink().handler)

        await expect(run.outcome).rejects.toMatchObject({ details: 'url is empty' })
    })

    it('resolves as cancelled once a running download is cancelled', async () => {
        host.script({ hold: true, progress: [3] })

        const run = await adapter.start({ url: 'u', path: 'p' }, sink().handler)
        await run.cancel()

        await expect(run.outcome).resolves.toMatchObject({ cancelled: true })
        expect(host.cancelled).toEqual([run.id])
    })

    it('ignores the events of another download', async () => {
        host.script({ hold: true })
        const { ticks, handler } = sink()

        const run = await adapter.start({ url: 'u', path: 'p' }, handler)
        host.progress('someone-else', 1, 2)

        expect(ticks).toEqual([])
        expect(run.isFinished).toBe(false)
    })

    it('fails without calling Go when there is no desktop runtime', async () => {
        delete (window as any).chrome

        const run = await adapter.start({ url: 'u', path: 'p' }, sink().handler)

        await expect(run.outcome).rejects.toBeInstanceOf(ApiError)
        expect(start).not.toHaveBeenCalled()
    })
})
