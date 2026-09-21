import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const fake = vi.hoisted(() => ({
    create: vi.fn(async () => 'payments'),
}))

vi.mock('@/application/services/namespace/NamespaceService', () => ({
    NamespaceService: class {
        public create = fake.create
    },
}))

import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'
import { ApiError } from '@/domain/errors/ApiError'
import { NamespaceCreatedEvent } from '@/domain/events/cluster/NamespaceCreatedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { KubeResourceRegistry } from '@/domain/models/kube'
import { NamespaceStore } from '@/store/modules/namespace/NamespaceStore'

const store = container.resolve(NamespaceStore)
const eventBus = container.resolve(EventBus)

const errors: AppErrorEvent[] = []
const created: NamespaceCreatedEvent[] = []

eventBus.registerHandler(AppErrorEvent, event => void errors.push(event))
eventBus.registerHandler(NamespaceCreatedEvent, event => void created.push(event))

const request = { clusterId: 'prod', kind: KubeResourceRegistry.find('', 'namespaces')!, name: 'payments' }

describe('NamespaceStore', () => {
    beforeEach(() => {
        errors.length = 0
        created.length = 0
        vi.clearAllMocks()
        store.creating = false
    })

    it('announces the name the cluster settled on', async () => {
        expect(await store.create(request)).toBe(true)

        expect(created[0]).toMatchObject({ clusterId: 'prod', name: 'payments' })
        expect(store.creating).toBe(false)
    })

    it('turns a refusal into an error event rather than a throw', async () => {
        fake.create.mockRejectedValueOnce(new ApiError('Namespace already exists', 'AlreadyExists', 409))

        expect(await store.create(request)).toBe(false)
        expect(errors).toHaveLength(1)
        expect(created).toHaveLength(0)
        expect(store.creating).toBe(false)
    })
})
