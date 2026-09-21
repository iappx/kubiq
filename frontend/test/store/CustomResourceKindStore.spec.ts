import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const fake = vi.hoisted(() => {
    const state = { refined: null as unknown, failure: undefined as Error | undefined }

    return {
        state,
        printerColumns: vi.fn(async () => {
            if (state.failure) {
                throw state.failure
            }
            return state.refined
        }),
    }
})

vi.mock('@/application/services/customResource/CustomResourceService', async () => {
    const actual = await vi.importActual<typeof import('@/application/services/customResource/CustomResourceService')>(
        '@/application/services/customResource/CustomResourceService',
    )

    return {
        CustomResourceService: class {
            public static definesColumns = actual.CustomResourceService.definesColumns

            public printerColumns = fake.printerColumns
        },
    }
})

import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { KubeColumns, KubeResourceKind, KubeResourceRegistry, KubeVerbCatalog } from '@/domain/models/kube'
import { CustomResourceKindStore } from '@/store/modules/customResourceKind/CustomResourceKindStore'

const store = container.resolve(CustomResourceKindStore)
const eventBus = container.resolve(EventBus)

const errors: AppErrorEvent[] = []
eventBus.registerHandler(AppErrorEvent, event => void errors.push(event))

const widgets = new KubeResourceKind({
    group: 'example.test',
    version: 'v1',
    resource: 'widgets',
    kind: 'Widget',
    title: 'Widget',
    namespaced: true,
    section: 'custom',
    icon: 'Puzzle',
    columns: KubeColumns.baseWithAge(true),
    verbs: KubeVerbCatalog.all(),
    isCustom: true,
})

const withColumns = widgets.withDefinition({
    columns: [...KubeColumns.base(true), { key: 'Phase', title: 'Phase', jsonPath: '.status.phase' }],
})

describe('CustomResourceKindStore', () => {
    beforeEach(() => {
        errors.length = 0
        fake.state.refined = null
        fake.state.failure = undefined
        vi.clearAllMocks()
        store.refined = {}
        store.resolvedKeys = []
    })

    it('hands back the kind it was given until a definition refines it', () => {
        expect(store.kindOf('prod', widgets)).toBe(widgets)
        expect(store.kindOf('prod', null)).toBeNull()
    })

    it('swaps in the refined kind once the definition has been read', async () => {
        fake.state.refined = withColumns

        await store.resolve('prod', widgets)

        expect(store.kindOf('prod', widgets)?.columns.map(column => column.key)).toEqual(['name', 'namespace', 'Phase'])
    })

    it('asks once per cluster and kind, however often the screen opens', async () => {
        fake.state.refined = withColumns

        await store.resolve('prod', widgets)
        await store.resolve('prod', widgets)

        expect(fake.printerColumns).toHaveBeenCalledTimes(1)
    })

    it('does not ask about a built-in kind at all', async () => {
        await store.resolve('prod', KubeResourceRegistry.find('', 'pods')!)

        expect(fake.printerColumns).not.toHaveBeenCalled()
    })

    it('keeps the base columns and raises the failure when the read breaks', async () => {
        fake.state.failure = new ApiError('boom', 'boom', 500)

        await store.resolve('prod', widgets)

        expect(store.kindOf('prod', widgets)).toBe(widgets)
        expect(errors).toHaveLength(1)
    })

    it('clears a disconnected cluster and asks again next time', async () => {
        fake.state.refined = withColumns
        await store.resolve('prod', widgets)

        store.forget('prod')

        expect(store.kindOf('prod', widgets)).toBe(widgets)

        await store.resolve('prod', widgets)
        expect(fake.printerColumns).toHaveBeenCalledTimes(2)
    })
})
