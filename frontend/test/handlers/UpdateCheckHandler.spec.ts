import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const fake = vi.hoisted(() => {
    const state = {
        settlement: null as any,
        settleFails: null as Error | null,
        checkForUpdates: true,
    }

    return {
        state,
        settle: vi.fn(async () => {
            if (state.settleFails) {
                throw state.settleFails
            }
            return state.settlement
        }),
        latest: vi.fn(async () => null),
        read: vi.fn(async () => ({ checkForUpdates: state.checkForUpdates })),
    }
})

vi.mock('@/application/services/update/UpdateService', () => ({
    UpdateService: class {
        public settle = fake.settle

        public latest = fake.latest

        public currentVersion(): string {
            return '0.2.0'
        }
    },
}))

import { UpdateCheckHandler } from '@/application/handlers/update/UpdateCheckHandler'
import { SettingsService } from '@/application/services/settings/SettingsService'
import { ToastService } from '@/application/services/toast/ToastService'
import { UpdateService } from '@/application/services/update/UpdateService'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ToastStore } from '@/store/modules/toast/ToastStore'
import { UpdateStore } from '@/store/modules/update/UpdateStore'

const eventBus = container.resolve(EventBus)
const toastStore = container.resolve(ToastStore)
const updateStore = container.resolve(UpdateStore)
const settings = { read: fake.read } as unknown as SettingsService

const errors: AppErrorEvent[] = []
eventBus.registerHandler(AppErrorEvent, e => void errors.push(e))

const build = (): UpdateCheckHandler => new UpdateCheckHandler(
    eventBus,
    container.resolve(UpdateService),
    settings,
    container.resolve(ToastService),
    updateStore,
)

const last = () => toastStore.items[toastStore.items.length - 1]

describe('UpdateCheckHandler', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        Object.assign(fake.state, { settlement: null, settleFails: null, checkForUpdates: true })
        fake.settle.mockClear()
        fake.latest.mockClear()
        toastStore.items = []
        errors.splice(0, errors.length)
        updateStore.phase = 'idle'
    })

    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
    })

    it('says the update took once the new version starts', async () => {
        fake.state.settlement = { target: '0.2.0', current: '0.2.0', applied: true }

        build()
        await vi.waitFor(() => expect(toastStore.items).toHaveLength(1))

        expect(last()).toMatchObject({ type: 'success', message: 'Updated to kubiq 0.2.0' })
    })

    it('warns when the old version is still running after an update', async () => {
        fake.state.settlement = { target: '0.3.0', current: '0.2.0', applied: false }

        build()
        await vi.waitFor(() => expect(toastStore.items).toHaveLength(1))

        expect(last()).toMatchObject({ type: 'warning', message: 'The update to kubiq 0.3.0 did not finish' })
        expect(last().description).toContain('kubiq 0.2.0 is still installed')
    })

    it('says nothing when no update was installed', async () => {
        build()
        await vi.waitFor(() => expect(fake.settle).toHaveBeenCalled())

        expect(toastStore.items).toEqual([])
    })

    it('raises a failure to read the pending update', async () => {
        fake.state.settleFails = new Error('disk gone')

        build()
        await vi.waitFor(() => expect(errors).toHaveLength(1))
    })

    it('checks shortly after start and then once a day', async () => {
        build()

        await vi.advanceTimersByTimeAsync(UpdateCheckHandler.startupDelayMs - 1)
        expect(fake.latest).not.toHaveBeenCalled()

        await vi.advanceTimersByTimeAsync(1)
        expect(fake.latest).toHaveBeenCalledTimes(1)

        await vi.advanceTimersByTimeAsync(UpdateCheckHandler.intervalMs)
        expect(fake.latest).toHaveBeenCalledTimes(2)
    })

    it('never checks while the setting is off', async () => {
        fake.state.checkForUpdates = false

        build()
        await vi.advanceTimersByTimeAsync(UpdateCheckHandler.startupDelayMs + UpdateCheckHandler.intervalMs)

        expect(fake.latest).not.toHaveBeenCalled()
    })
})
