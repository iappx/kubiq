import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { EventScopeService } from '@/application/services/eventScope/EventScopeService'
import type { TEventScope } from '@/domain/entities/cluster'
import { KubeResourceRegistry } from '@/domain/models/kube'
import { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'

const transport = new MemoryKubeTransport()

const events = KubeResourceRegistry.find('', 'events')!

const connectionService = {
    context: () => EntityRepo.create().use(KubeEntityContext, transport as never).getContext(KubeEntityContext),
} as unknown as ClusterConnectionService

const scope = (changes: Partial<TEventScope> = {}): TEventScope => ({
    type: '',
    objectKind: '',
    objectName: '',
    ...changes,
})

let service: EventScopeService

describe('EventScopeService', () => {
    beforeEach(() => {
        transport.reset()
        service = new EventScopeService(connectionService)
    })

    it('asks for nothing when the scope is empty', () => {
        expect(service.fieldSelectorFor('prod', events, scope())).toBe('')
    })

    it('compiles a type into the field selector the API server takes', () => {
        expect(service.fieldSelectorFor('prod', events, scope({ type: 'Warning' }))).toBe('type=Warning')
    })

    it('joins the object kind and name into one conjunction', () => {
        const selector = service.fieldSelectorFor('prod', events, scope({ objectKind: 'Pod', objectName: 'web-1' }))

        expect(selector).toBe('involvedObject.kind=Pod,involvedObject.name=web-1')
    })

    it('carries every part of a full scope', () => {
        const selector = service.fieldSelectorFor('prod', events, scope({
            type: 'Warning',
            objectKind: 'Pod',
            objectName: 'web-1',
        }))

        expect(selector).toBe('type=Warning,involvedObject.kind=Pod,involvedObject.name=web-1')
    })
})
