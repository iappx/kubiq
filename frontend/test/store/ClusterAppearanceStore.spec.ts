import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

vi.mock('@/infrastructure/entityRepo/transport/FileSystemTransport', async () => {
    const { singleton } = await import('tsyringe')
    const { MemoryFileTransport } = await import('../support/MemoryFileTransport')

    class FileSystemTransport extends MemoryFileTransport {}
    singleton()(FileSystemTransport)

    return { FileSystemTransport }
})

import type { TClusterAppearanceDraft } from '@/domain/entities/catalog/types/TClusterAppearanceDraft'
import { ClusterMonogram } from '@/domain/entities/catalog/ClusterMonogram'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { ClusterAppearanceStore } from '@/store/modules/clusterAppearance/ClusterAppearanceStore'
import type { MemoryFileTransport } from '../support/MemoryFileTransport'

const transport = container.resolve(FileSystemTransport) as unknown as MemoryFileTransport

const store = container.resolve(ClusterAppearanceStore)
const eventBus = container.resolve(EventBus)

const errors: AppErrorEvent[] = []
eventBus.registerHandler(AppErrorEvent, (event) => {
    errors.push(event)
})

const draft = (overrides: Partial<TClusterAppearanceDraft> = {}): TClusterAppearanceDraft => ({
    displayName: 'Production',
    iconKind: 'glyph',
    initials: 'PR',
    color: 'red',
    glyph: 'shield',
    imageFile: '',
    ...overrides,
})

describe('ClusterAppearanceStore', () => {
    beforeEach(() => {
        transport.files.clear()
        errors.length = 0
        store.clear()
    })

    it('answers generated initials and the context name for a cluster nobody customized', () => {
        expect(store.isCustomized('prod-eu')).toBe(false)
        expect(store.displayNameOf('prod-eu')).toBe('prod-eu')
        expect(store.iconOf('prod-eu')).toEqual(ClusterMonogram.iconFor('prod-eu'))
    })

    it('shows a saved appearance at once', async () => {
        await expect(store.save('prod', draft())).resolves.toBe(true)

        expect(store.isCustomized('prod')).toBe(true)
        expect(store.displayNameOf('prod')).toBe('Production')
        expect(store.iconOf('prod')).toMatchObject({ kind: 'glyph', glyph: 'shield', color: 'red' })
    })

    it('reads saved appearances back after a restart', async () => {
        await store.save('prod', draft())
        store.clear()

        await store.loadOnce()

        expect(store.displayNameOf('prod')).toBe('Production')
    })

    it('falls back to the context name when the display name is left empty', async () => {
        await store.save('prod', draft({ displayName: '  ' }))

        expect(store.displayNameOf('prod')).toBe('prod')
    })

    it('keeps one appearance per cluster', async () => {
        await store.save('prod', draft({ color: 'red' }))
        await store.save('prod', draft({ color: 'blue' }))

        expect(store.items).toHaveLength(1)
        expect(store.iconOf('prod').color).toBe('blue')
    })

    it('goes back to the generated icon on reset', async () => {
        await store.save('prod', draft())

        await expect(store.reset('prod')).resolves.toBe(true)

        expect(store.isCustomized('prod')).toBe(false)
        expect(store.iconOf('prod')).toEqual(ClusterMonogram.iconFor('prod'))
    })

    it('raises a failure instead of throwing, and keeps what it showed', async () => {
        await store.save('prod', draft())

        await expect(store.save('prod', draft({ iconKind: 'image' }))).resolves.toBe(false)

        expect(errors).toHaveLength(1)
        expect(store.iconOf('prod').kind).toBe('glyph')
    })
})
