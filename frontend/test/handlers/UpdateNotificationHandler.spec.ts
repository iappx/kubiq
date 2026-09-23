import { beforeEach, describe, expect, it } from 'vitest'
import { container } from 'tsyringe'
import { UpdateNotificationHandler } from '@/application/handlers/update/UpdateNotificationHandler'
import { UpdateAvailableEvent } from '@/domain/events/update/UpdateAvailableEvent'
import { UpdateDownloadedEvent } from '@/domain/events/update/UpdateDownloadedEvent'
import { AppSettings } from '@/domain/models/settings'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { AppSettingsStore } from '@/store/modules/settings/AppSettingsStore'
import { ToastStore } from '@/store/modules/toast/ToastStore'

container.resolve(UpdateNotificationHandler)
const eventBus = container.resolve(EventBus)
const settingsStore = container.resolve(AppSettingsStore)
const toastStore = container.resolve(ToastStore)

const last = () => toastStore.items[toastStore.items.length - 1]

describe('UpdateNotificationHandler', () => {
    beforeEach(() => {
        toastStore.items = []
        settingsStore.settings = AppSettings.defaults()
    })

    it('announces a release found by a background check', () => {
        eventBus.emitEvent(new UpdateAvailableEvent('0.2.0', true))

        expect(last()).toMatchObject({ type: 'info', message: 'kubiq 0.2.0 is available' })
    })

    it('leaves a check the user asked for to the settings page', () => {
        eventBus.emitEvent(new UpdateAvailableEvent('0.2.0', false))

        expect(toastStore.items).toEqual([])
    })

    it('keeps quiet about a version the user chose to skip', () => {
        settingsStore.settings = { ...AppSettings.defaults(), skippedVersion: '0.2.0' }

        eventBus.emitEvent(new UpdateAvailableEvent('0.2.0', true))
        expect(toastStore.items).toEqual([])

        eventBus.emitEvent(new UpdateAvailableEvent('0.3.0', true))
        expect(last()).toMatchObject({ message: 'kubiq 0.3.0 is available' })
    })

    it('announces a verified download', () => {
        eventBus.emitEvent(new UpdateDownloadedEvent('0.2.0'))

        expect(last()).toMatchObject({ type: 'success', message: 'kubiq 0.2.0 is downloaded' })
    })
})
