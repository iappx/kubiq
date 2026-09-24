import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const fake = vi.hoisted(() => {
    const state = {
        prepareFailure: undefined as Error | undefined,
        applyFailure: undefined as Error | undefined,
        pending: undefined as Promise<void> | undefined,
    }

    return {
        state,
        prepare: vi.fn(async (target: { name: string }, isDefault: boolean) => {
            if (state.prepareFailure) {
                throw state.prepareFailure
            }
            return {
                target,
                isDefault,
                cleared: isDefault ? ['standard'] : [],
                patches: [],
            }
        }),
        apply: vi.fn(async () => {
            await state.pending
            if (state.applyFailure) {
                throw state.applyFailure
            }
        }),
    }
})

vi.mock('@/application/services/defaultClass/DefaultClassService', () => ({
    DefaultClassService: class {
        public prepare = fake.prepare

        public apply = fake.apply
    },
}))

import type { TDefaultClassPlan } from '@/application/services/defaultClass/types/TDefaultClassPlan'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { DefaultClassChangedEvent } from '@/domain/events/cluster/DefaultClassChangedEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeResourceRegistry } from '@/domain/models/kube'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { DefaultClassStore } from '@/store/modules/defaultClass/DefaultClassStore'

const store = container.resolve(DefaultClassStore)
const eventBus = container.resolve(EventBus)

const errors: AppErrorEvent[] = []
const changes: DefaultClassChangedEvent[] = []

eventBus.registerHandler(AppErrorEvent, event => void errors.push(event))
eventBus.registerHandler(DefaultClassChangedEvent, event => void changes.push(event))

const storageClasses = KubeResourceRegistry.find('storage.k8s.io', 'storageclasses')!

const target = { clusterId: 'prod', kind: storageClasses, name: 'fast', rowKey: 'fast-uid' }

const plan = (): TDefaultClassPlan => ({
    target,
    isDefault: true,
    cleared: ['standard'],
    patches: [{ name: 'standard', isDefault: false }, { name: 'fast', isDefault: true }],
})

describe('DefaultClassStore', () => {
    beforeEach(() => {
        errors.length = 0
        changes.length = 0
        fake.state.prepareFailure = undefined
        fake.state.applyFailure = undefined
        fake.state.pending = undefined
        store.actingKeys = []
    })

    it('hands back the plan the service prepared', async () => {
        const prepared = await store.prepare(target, true)

        expect(prepared).toMatchObject({ isDefault: true, cleared: ['standard'] })
    })

    it('reports a failed preparation as an error and hands back no plan', async () => {
        fake.state.prepareFailure = new ApiError('The storage classes could not be read')

        const prepared = await store.prepare(target, true)

        expect(prepared).toBeNull()
        expect(errors).toHaveLength(1)
        expect(errors[0].context).toBe('DefaultClassStore.prepare')
    })

    it('announces the change once the cluster accepted it', async () => {
        const applied = await store.apply(plan())

        expect(applied).toBe(true)
        expect(changes).toHaveLength(1)
        expect(changes[0]).toMatchObject({
            clusterId: 'prod',
            kindName: 'StorageClass',
            name: 'fast',
            isDefault: true,
            cleared: ['standard'],
        })
    })

    it('reports a refused write as an error and announces nothing', async () => {
        fake.state.applyFailure = new ApiError('Forbidden')

        const applied = await store.apply(plan())

        expect(applied).toBe(false)
        expect(changes).toHaveLength(0)
        expect(errors[0].context).toBe('DefaultClassStore.apply')
    })

    it('marks the row busy while the write is in flight', async () => {
        let release: () => void = () => undefined
        fake.state.pending = new Promise<void>((resolve) => {
            release = resolve
        })

        const applying = store.apply(plan())

        expect(store.busyRowKeys('prod')).toEqual(['fast-uid'])
        expect(store.busyRowKeys('staging')).toEqual([])

        release()
        await applying

        expect(store.busyRowKeys('prod')).toEqual([])
    })
})
