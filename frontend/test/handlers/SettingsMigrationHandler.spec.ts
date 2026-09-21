import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'
import { SettingsMigrationHandler } from '@/application/handlers/settings/SettingsMigrationHandler'
import type { SettingsService } from '@/application/services/settings/SettingsService'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import type { AppSettingsStore } from '@/store/modules/settings/AppSettingsStore'

const eventBus = container.resolve(EventBus)

const errors: AppErrorEvent[] = []
eventBus.registerHandler(AppErrorEvent, (event) => {
    errors.push(event)
})

const migrate = vi.fn()
const loadOnce = vi.fn()

const settled = () => new Promise(resolve => setTimeout(resolve, 0))

const start = (): void => {
    void new SettingsMigrationHandler(
        eventBus,
        { migrate } as unknown as SettingsService,
        { loadOnce } as unknown as AppSettingsStore,
    )
}

describe('SettingsMigrationHandler', () => {
    beforeEach(() => {
        errors.length = 0
        migrate.mockReset().mockResolvedValue(1)
        loadOnce.mockReset().mockResolvedValue(undefined)
    })

    it('brings the stored format up to date before anything reads it', async () => {
        start()
        await settled()

        expect(migrate).toHaveBeenCalledTimes(1)
        expect(loadOnce).toHaveBeenCalledTimes(1)
    })

    it('warms the settings so a screen does not wait for the first read', async () => {
        start()
        await settled()

        expect(loadOnce.mock.invocationCallOrder[0]).toBeGreaterThan(migrate.mock.invocationCallOrder[0])
    })

    it('raises a failed migration and leaves the settings unread', async () => {
        migrate.mockRejectedValue(new ApiError('Could not save the changes', 'the profile is read-only'))

        start()
        await settled()

        expect(errors).toHaveLength(1)
        expect(errors[0].context).toBe('SettingsMigrationHandler.migrate')
        expect(loadOnce).not.toHaveBeenCalled()
    })

    it('does not throw out of the constructor when the migration fails', async () => {
        migrate.mockRejectedValue(new Error('boom'))

        expect(() => start()).not.toThrow()
        await settled()
    })
})
