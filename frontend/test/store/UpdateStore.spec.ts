import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

// The store is resolved when its module is imported, so its collaborator is replaced at
// module level rather than through the container afterwards.
const fake = vi.hoisted(() => {
    const state = {
        offer: null as any,
        latestFails: null as Error | null,
        downloaded: null as any,
        downloadFails: null as Error | null,
        installFails: null as Error | null,
        ticks: [] as [number, number][],
        release: null as ((value: any) => void) | null,
    }

    return {
        state,
        latest: vi.fn(async () => {
            if (state.latestFails) {
                throw state.latestFails
            }
            return state.offer
        }),
        download: vi.fn(async (_offer: any, sink: { onProgress: (received: number, total: number) => void }) => {
            state.ticks.forEach(([received, total]) => sink.onProgress(received, total))
            if (state.downloadFails) {
                throw state.downloadFails
            }
            if (state.release) {
                return new Promise(resolve => {
                    state.release = resolve
                })
            }
            return state.downloaded
        }),
        cancelDownload: vi.fn(async () => undefined),
        install: vi.fn(async () => {
            if (state.installFails) {
                throw state.installFails
            }
        }),
        openReleasePage: vi.fn(async () => undefined),
    }
})

vi.mock('@/application/services/update/UpdateService', () => ({
    UpdateService: class {
        public latest = fake.latest

        public download = fake.download

        public cancelDownload = fake.cancelDownload

        public install = fake.install

        public openReleasePage = fake.openReleasePage

        public currentVersion(): string {
            return '0.1.0'
        }
    },
}))

import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { UpdateAvailableEvent } from '@/domain/events/update/UpdateAvailableEvent'
import { UpdateDownloadedEvent } from '@/domain/events/update/UpdateDownloadedEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { UpdateStore } from '@/store/modules/update/UpdateStore'

const store = container.resolve(UpdateStore)
const eventBus = container.resolve(EventBus)

const offer = {
    version: '0.2.0',
    title: 'kubiq 0.2.0',
    notes: '',
    notesUrl: 'https://github.com/iappx/kubiq/releases/tag/v0.2.0',
    publishedAt: '2026-09-30T10:00:00Z',
    asset: { name: 'kubiq-0.2.0-windows-amd64-installer.exe', url: 'https://dl', size: 100, sha256: 'a'.repeat(64) },
    installable: true,
}

const downloaded = { version: '0.2.0', path: 'userdata:updates/kubiq.exe', size: 100 }

const emitted: unknown[] = []
eventBus.registerHandler(UpdateAvailableEvent, e => void emitted.push(e))
eventBus.registerHandler(UpdateDownloadedEvent, e => void emitted.push(e))
eventBus.registerHandler(AppErrorEvent, e => void emitted.push(e))

describe('UpdateStore', () => {
    beforeEach(() => {
        Object.assign(fake.state, {
            offer: null, latestFails: null, downloaded, downloadFails: null, installFails: null, ticks: [], release: null,
        })
        Object.values(fake).forEach(value => typeof value === 'function' && 'mockClear' in value && value.mockClear())
        Object.assign(store, {
            phase: 'idle', offer: null, downloaded: null, received: 0, total: 0, checkedAt: 0, checkError: '',
        })
        emitted.splice(0, emitted.length)
    })

    it('shows the installed version', () => {
        expect(store.currentVersion).toBe('0.1.0')
    })

    describe('check', () => {
        it('says the installed version is current when nothing newer is offered', async () => {
            await store.check(false)

            expect(store.phase).toBe('upToDate')
            expect(store.checkedAt).toBeGreaterThan(0)
            expect(emitted).toEqual([])
        })

        it('keeps the offer and announces it, marking whether anybody asked', async () => {
            fake.state.offer = offer

            await store.check(true)

            expect(store.phase).toBe('available')
            expect(store.offer).toEqual(offer)
            expect(emitted).toEqual([new UpdateAvailableEvent('0.2.0', true)])
        })

        it('raises the failure of a check the user asked for', async () => {
            fake.state.latestFails = new ApiError('Could not reach GitHub to check for updates')

            await store.check(false)

            expect(store.phase).toBe('idle')
            expect(store.checkError).toBe('Could not reach GitHub to check for updates')
            expect(emitted).toHaveLength(1)
            expect(emitted[0]).toBeInstanceOf(AppErrorEvent)
        })

        it('keeps the failure of a background check on the page instead of raising it', async () => {
            fake.state.latestFails = new ApiError('Could not reach GitHub to check for updates')

            await store.check(true)

            expect(store.checkError).toBe('Could not reach GitHub to check for updates')
            expect(emitted).toEqual([])
        })

        it('does not replace an update that is already downloaded', async () => {
            store.phase = 'downloaded'

            await store.check(true)

            expect(fake.latest).not.toHaveBeenCalled()
            expect(store.phase).toBe('downloaded')
        })
    })

    describe('download', () => {
        beforeEach(async () => {
            fake.state.offer = offer
            await store.check(false)
            emitted.splice(0, emitted.length)
        })

        it('tracks the progress and ends with a verified download it announces', async () => {
            fake.state.ticks = [[40, 100], [100, 100]]

            await store.download()

            expect(store.received).toBe(100)
            expect(store.total).toBe(100)
            expect(store.phase).toBe('downloaded')
            expect(store.downloaded).toEqual(downloaded)
            expect(emitted).toEqual([new UpdateDownloadedEvent('0.2.0')])
        })

        it('is downloading while the file is on its way', async () => {
            fake.state.release = () => undefined

            const running = store.download()
            await vi.waitFor(() => expect(fake.download).toHaveBeenCalled())

            expect(store.phase).toBe('downloading')
            expect(store.total).toBe(100)

            fake.state.release?.(null)
            await running
        })

        it('goes back to the offer when the download is cancelled', async () => {
            fake.state.downloaded = null

            await store.download()

            expect(store.phase).toBe('available')
            expect(emitted).toEqual([])
        })

        it('goes back to the offer and raises the failure when the download fails', async () => {
            fake.state.downloadFails = new ApiError('The downloaded installer of kubiq 0.2.0 is damaged and was deleted')

            await store.download()

            expect(store.phase).toBe('available')
            expect(emitted[0]).toBeInstanceOf(AppErrorEvent)
        })

        it('cancels only a running download', async () => {
            await store.cancelDownload()
            expect(fake.cancelDownload).not.toHaveBeenCalled()

            store.phase = 'downloading'
            await store.cancelDownload()
            expect(fake.cancelDownload).toHaveBeenCalledOnce()
        })
    })

    describe('install', () => {
        beforeEach(async () => {
            fake.state.offer = offer
            await store.check(false)
            await store.download()
            emitted.splice(0, emitted.length)
        })

        it('hands the verified download to the service', async () => {
            await store.install()

            expect(fake.install).toHaveBeenCalledWith(downloaded)
            expect(store.phase).toBe('installing')
        })

        it('returns to the downloaded state and raises the failure when the installer does not start', async () => {
            fake.state.installFails = new ApiError('Could not start the installer of kubiq 0.2.0')

            await store.install()

            expect(store.phase).toBe('downloaded')
            expect(emitted[0]).toBeInstanceOf(AppErrorEvent)
        })
    })

    it('opens the release page of the offer it holds', async () => {
        await store.openReleasePage()
        expect(fake.openReleasePage).not.toHaveBeenCalled()

        fake.state.offer = offer
        await store.check(false)
        await store.openReleasePage()

        expect(fake.openReleasePage).toHaveBeenCalledWith(offer)
    })
})
