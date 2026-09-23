import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const start = vi.fn()
const cancel = vi.fn()
const launch = vi.fn()
const fileExists = vi.fn()
const openUri = vi.fn()
const environment = vi.fn()
const quit = vi.fn()

vi.mock('../../../bindings/iappx_k8s_admin/core/services/download', () => ({
    DownloadService: {
        Start: (...args: unknown[]) => start(...args),
        Cancel: (...args: unknown[]) => cancel(...args),
    },
}))

vi.mock('../../../bindings/iappx_k8s_admin/core/services/process', () => ({
    ProcessService: {
        Launch: (...args: unknown[]) => launch(...args),
    },
}))

vi.mock('../../../bindings/iappx_k8s_admin/core/services/io', () => ({
    IoService: {
        FileExists: (...args: unknown[]) => fileExists(...args),
        OpenURI: (...args: unknown[]) => openUri(...args),
    },
}))

vi.mock('@wailsio/runtime', async importOriginal => ({
    ...(await importOriginal<Record<string, unknown>>()),
    System: { Environment: () => environment() },
    Application: { Quit: () => quit() },
}))

import { UpdateService } from '@/application/services/update/UpdateService'
import type { TUpdateOffer } from '@/application/services/update/types/TUpdateOffer'
import { AppEnvironment } from '@/config/AppEnvironment'
import { ApiError } from '@/domain/errors/ApiError'
import { DownloadAdapter } from '@/infrastructure/download/DownloadAdapter'
import { ReleaseContextProvider } from '@/infrastructure/entityRepo/release/ReleaseContextProvider'
import { ReleaseTransport } from '@/infrastructure/entityRepo/release/transport/ReleaseTransport'
import type { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { HostShellAdapter } from '@/infrastructure/process/HostShellAdapter'
import { ProcessAdapter } from '@/infrastructure/process/ProcessAdapter'
import { PendingUpdateAdapter } from '@/infrastructure/update/PendingUpdateAdapter'
import { AppHostAdapter } from '@/infrastructure/wails/AppHostAdapter'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'
import { MemoryDownloadHost } from '../../support/MemoryDownloadHost'
import { MemoryFileTransport } from '../../support/MemoryFileTransport'

const INSTALLER = 'kubiq-0.2.0-windows-amd64-installer.exe'
const INSTALLER_PATH = `userdata:updates/${INSTALLER}`
const BODY = 'the 0.2.0 installer'

const fetchMock = vi.fn()
const host = new MemoryDownloadHost()

let files: MemoryFileTransport
let service: UpdateService
let digest: string

const release = (overrides: Record<string, unknown> = {}) => ({
    id: 7,
    tag_name: 'v0.2.0',
    name: 'kubiq 0.2.0',
    draft: false,
    prerelease: false,
    html_url: 'https://github.com/iappx/kubiq/releases/tag/v0.2.0',
    published_at: '2026-09-30T10:00:00Z',
    body: 'Notes',
    assets: [
        { id: 1, name: 'kubiq-0.2.0-linux-amd64', size: 5, browser_download_url: 'https://dl/linux', digest: `sha256:${'1'.repeat(64)}` },
        { id: 2, name: INSTALLER, size: BODY.length, browser_download_url: 'https://dl/installer', digest: `sha256:${digest}` },
    ],
    ...overrides,
})

const answer = (body: unknown): Response => new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
})

const build = (): UpdateService => {
    const runtime = new WailsRuntimeService()

    return new UpdateService(
        new ReleaseContextProvider(new ReleaseTransport()),
        new DownloadAdapter(runtime),
        new ProcessAdapter(runtime),
        new AppHostAdapter(runtime),
        new HostShellAdapter(runtime),
        new PendingUpdateAdapter(files as unknown as FileSystemTransport),
    )
}

const offer = async (): Promise<TUpdateOffer> => {
    const found = await service.latest()
    if (!found) {
        throw new Error('the fixture release was not offered')
    }
    return found
}

describe('UpdateService', () => {
    beforeAll(async () => {
        digest = await MemoryDownloadHost.sha256Of(BODY)
    })

    beforeEach(() => {
        ;(AppEnvironment as { Version: string }).Version = '0.1.0'
        ;(window as any).chrome = { webview: { postMessage: () => undefined } }

        host.reset()
        files = new MemoryFileTransport()
        service = build()

        for (const mock of [start, cancel, launch, fileExists, openUri, environment, quit, fetchMock]) {
            mock.mockReset()
        }
        start.mockImplementation((spec: any) => host.start(spec))
        cancel.mockImplementation((id: string) => host.cancel(id))
        fileExists.mockResolvedValue({ success: true, data: 'true' })
        environment.mockResolvedValue({ OS: 'windows', Arch: 'amd64' })
        launch.mockResolvedValue({ success: true, error: '' })
        quit.mockResolvedValue(undefined)
        fetchMock.mockImplementation(() => Promise.resolve(answer(release())))
        vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    describe('latest', () => {
        it('offers a newer release with the installer for this system and its published digest', async () => {
            await expect(service.latest()).resolves.toEqual({
                version: '0.2.0',
                title: 'kubiq 0.2.0',
                notes: 'Notes',
                notesUrl: 'https://github.com/iappx/kubiq/releases/tag/v0.2.0',
                publishedAt: '2026-09-30T10:00:00Z',
                asset: { name: INSTALLER, url: 'https://dl/installer', size: BODY.length, sha256: digest },
                installable: true,
            })
            expect(fileExists).toHaveBeenCalledWith('uninstall.exe')
        })

        it('offers nothing when the latest release is the installed one', async () => {
            ;(AppEnvironment as { Version: string }).Version = '0.2.0'

            await expect(service.latest()).resolves.toBeNull()
        })

        it('offers nothing for a draft, a pre-release or a tag it cannot read', async () => {
            fetchMock.mockImplementationOnce(() => Promise.resolve(answer(release({ prerelease: true }))))
            await expect(service.latest()).resolves.toBeNull()

            fetchMock.mockImplementationOnce(() => Promise.resolve(answer(release({ draft: true }))))
            await expect(service.latest()).resolves.toBeNull()

            fetchMock.mockImplementationOnce(() => Promise.resolve(answer(release({ tag_name: 'nightly' }))))
            await expect(service.latest()).resolves.toBeNull()
        })

        it('cannot install over a copy that the installer did not set up', async () => {
            fileExists.mockResolvedValue({ success: true, data: 'false' })

            const found = await offer()

            expect(found.asset?.name).toBe(INSTALLER)
            expect(found.installable).toBe(false)
        })

        it('offers the release without an installer on a system it has none for', async () => {
            environment.mockResolvedValue({ OS: 'linux', Arch: 'amd64' })

            const found = await offer()

            expect(found.asset).toBeNull()
            expect(found.installable).toBe(false)
        })

        it('lets a GitHub failure through as an ApiError', async () => {
            fetchMock.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')))

            await expect(service.latest()).rejects.toBeInstanceOf(ApiError)
        })
    })

    describe('download', () => {
        it('downloads the installer into the user profile and verifies it', async () => {
            host.script({ body: BODY, progress: [4, BODY.length] })
            const ticks: number[] = []

            const downloaded = await service.download(await offer(), { onProgress: received => ticks.push(received) })

            expect(downloaded).toEqual({ version: '0.2.0', path: INSTALLER_PATH, size: BODY.length })
            expect(host.started[0]).toEqual({
                url: 'https://dl/installer',
                path: INSTALLER_PATH,
                headers: { accept: 'application/octet-stream' },
            })
            expect(ticks).toEqual([4, BODY.length])
        })

        it('deletes a download whose digest differs from the published one and says so', async () => {
            host.script({ body: 'tampered bytes' })

            const failure = await service.download(await offer(), { onProgress: () => undefined }).catch(err => err)

            expect(failure).toBeInstanceOf(ApiError)
            expect(failure.message).toContain('is damaged')
            expect(failure.details).toContain(digest)
            expect(files.removed).toEqual([INSTALLER_PATH])
        })

        it('refuses an installer the release publishes no checksum for', async () => {
            const found = await offer()
            found.asset = { ...found.asset!, sha256: '' }

            await expect(service.download(found, { onProgress: () => undefined })).rejects.toBeInstanceOf(ApiError)
            expect(start).not.toHaveBeenCalled()
        })

        it('answers nothing when the download is cancelled', async () => {
            host.script({ hold: true, progress: [2] })

            const pending = service.download(await offer(), { onProgress: () => void service.cancelDownload() })

            await expect(pending).resolves.toBeNull()
            expect(host.cancelled).toHaveLength(1)
        })

        it('names the version when the download itself fails', async () => {
            host.script({ error: 'server answered 502 Bad Gateway' })

            const failure = await service.download(await offer(), { onProgress: () => undefined }).catch(err => err)

            expect(failure).toBeInstanceOf(ApiError)
            expect(failure.message).toBe('Could not download kubiq 0.2.0')
            expect(failure.details).toBe('server answered 502 Bad Gateway')
        })

        it('refuses a second download while one is running', async () => {
            host.script({ hold: true })
            const found = await offer()

            const first = service.download(found, { onProgress: () => undefined })
            await vi.waitFor(() => expect(host.started).toHaveLength(1))

            await expect(service.download(found, { onProgress: () => undefined })).rejects.toBeInstanceOf(ApiError)

            await service.cancelDownload()
            await expect(first).resolves.toBeNull()
        })
    })

    describe('install', () => {
        it('records the pending update, starts the silent installer and quits', async () => {
            await service.install({ version: '0.2.0', path: INSTALLER_PATH, size: 1 })

            expect(files.read(PendingUpdateAdapter.File)).toEqual({ version: '0.2.0', installer: INSTALLER_PATH })
            expect(launch.mock.calls[0][0]).toMatchObject({ path: INSTALLER_PATH, args: ['/S', '/relaunch'] })
            expect(quit).toHaveBeenCalledOnce()
        })

        it('forgets the pending update and stays open when the installer does not start', async () => {
            launch.mockResolvedValue({ success: false, error: 'access denied' })

            const failure = await service.install({ version: '0.2.0', path: INSTALLER_PATH, size: 1 }).catch(err => err)

            expect(failure).toBeInstanceOf(ApiError)
            expect(failure.message).toBe('Could not start the installer of kubiq 0.2.0')
            expect(failure.details).toBe('access denied')
            expect(files.read(PendingUpdateAdapter.File)).toBeNull()
            expect(quit).not.toHaveBeenCalled()
        })
    })

    describe('settle', () => {
        it('answers nothing when no update was installed', async () => {
            await expect(service.settle()).resolves.toBeNull()
        })

        it('reports an applied update once the new version runs, and cleans up after it', async () => {
            ;(AppEnvironment as { Version: string }).Version = '0.2.0'
            files.seed(PendingUpdateAdapter.File, { version: '0.2.0', installer: INSTALLER_PATH })
            files.files.set(INSTALLER_PATH, 'bytes')

            await expect(service.settle()).resolves.toEqual({ target: '0.2.0', current: '0.2.0', applied: true })
            expect(files.files.has(INSTALLER_PATH)).toBe(false)
            expect(files.read(PendingUpdateAdapter.File)).toBeNull()
        })

        it('reports an update that did not take when the old version is still running', async () => {
            files.seed(PendingUpdateAdapter.File, { version: '0.2.0', installer: INSTALLER_PATH })

            await expect(service.settle()).resolves.toEqual({ target: '0.2.0', current: '0.1.0', applied: false })
            await expect(service.settle()).resolves.toBeNull()
        })
    })

    it('opens the release page of an offer', async () => {
        openUri.mockResolvedValue({ success: true, data: '' })

        await service.openReleasePage(await offer())

        expect(openUri).toHaveBeenCalledWith('https://github.com/iappx/kubiq/releases/tag/v0.2.0')
    })
})
