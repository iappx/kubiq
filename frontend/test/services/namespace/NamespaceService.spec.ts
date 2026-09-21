import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { NamespaceService } from '@/application/services/namespace/NamespaceService'
import { NamespaceDraftValidator } from '@/application/validators/NamespaceDraftValidator'
import { KubeResourceRegistry } from '@/domain/models/kube'
import { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'

const transport = new MemoryKubeTransport()

const namespaces = KubeResourceRegistry.find('', 'namespaces')!

const connectionService = {
    context: () => EntityRepo.create().use(KubeEntityContext, transport as never).getContext(KubeEntityContext),
} as unknown as ClusterConnectionService

const body = () => (transport.last.body ?? {}) as Record<string, any>

let service: NamespaceService

describe('NamespaceService', () => {
    beforeEach(() => {
        transport.reset()
        service = new NamespaceService(connectionService)
    })

    it('posts a namespace built from the entity, carrying nothing but its name', async () => {
        transport.answerWith({ metadata: { uid: 'ns-uid', name: 'payments' } })

        const created = await service.create({ clusterId: 'prod', kind: namespaces, name: 'payments' })

        expect(transport.last.method).toBe('POST')
        expect(transport.last.url).toBe('/api/v1/namespaces')
        expect(body()).toEqual({ apiVersion: 'v1', kind: 'Namespace', metadata: { name: 'payments' } })
        expect(created).toBe('payments')
    })

    it('reports the name it asked for when the cluster answers without one', async () => {
        transport.answerWith({})

        expect(await service.create({ clusterId: 'prod', kind: namespaces, name: 'payments' })).toBe('payments')
    })
})

describe('NamespaceDraftValidator', () => {
    const validator = new NamespaceDraftValidator()

    it('accepts a DNS-1123 label', () => {
        expect(validator.validate({ name: 'payments-2' })).toEqual({ valid: true, errors: {} })
    })

    it('trims before judging and before handing the name on', () => {
        expect(validator.validate({ name: '  payments  ' }).valid).toBe(true)
        expect(NamespaceDraftValidator.parse({ name: '  payments  ' })).toBe('payments')
    })

    it('rejects an empty name', () => {
        expect(validator.validate({ name: '   ' }).errors.name).toContain('Enter a name')
    })

    it('rejects capitals, underscores and edge hyphens', () => {
        expect(validator.validate({ name: 'Payments' }).valid).toBe(false)
        expect(validator.validate({ name: 'pay_ments' }).valid).toBe(false)
        expect(validator.validate({ name: '-payments' }).valid).toBe(false)
        expect(validator.validate({ name: 'payments-' }).valid).toBe(false)
    })

    it('rejects a name longer than a DNS label', () => {
        expect(validator.validate({ name: 'a'.repeat(64) }).errors.name).toContain('63')
    })

    it('keeps the user out of the names Kubernetes reserves', () => {
        expect(validator.validate({ name: 'kube-system' }).errors.name).toContain('reserved')
    })
})
