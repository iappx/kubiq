import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { DefaultClassService } from '@/application/services/defaultClass/DefaultClassService'
import type { TDefaultClassTarget } from '@/application/services/defaultClass/types/TDefaultClassTarget'
import { ResourceListService } from '@/application/services/resourceList/ResourceListService'
import { IngressClassEntity } from '@/domain/entities/network'
import { StorageClassEntity } from '@/domain/entities/storage'
import { KubeResourceRegistry } from '@/domain/models/kube'
import { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import { KubePatchRequestFactory } from '@/infrastructure/entityRepo/kube/strategies/KubePatchRequestFactory'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'

const transport = new MemoryKubeTransport()

const storageClasses = KubeResourceRegistry.find('storage.k8s.io', 'storageclasses')!
const ingressClasses = KubeResourceRegistry.find('networking.k8s.io', 'ingressclasses')!

const connectionService = {
    context: () => EntityRepo.create().use(KubeEntityContext, transport as never).getContext(KubeEntityContext),
} as unknown as ClusterConnectionService

const target = (name: string, kind = storageClasses): TDefaultClassTarget => ({
    clusterId: 'prod',
    kind,
    name,
    rowKey: `${name}-uid`,
})

const classList = (classes: Record<string, boolean | undefined>, annotation = StorageClassEntity.defaultAnnotation) => ({
    metadata: { resourceVersion: '10' },
    items: Object.keys(classes).map(name => ({
        metadata: {
            uid: `${name}-uid`,
            name,
            annotations: classes[name] === undefined ? {} : { [annotation]: String(classes[name]) },
        },
    })),
})

const patches = () => transport.requests
    .filter(request => request.method === 'PATCH')
    .map(request => ({ url: request.url, body: request.body }))

const storageFlag = (value: string) => ({
    metadata: { annotations: { [StorageClassEntity.defaultAnnotation]: value } },
})

let service: DefaultClassService

describe('DefaultClassService.plan', () => {
    it('clears the previous default before setting the new one', () => {
        const plan = DefaultClassService.plan(target('fast'), true, [
            { name: 'standard', isDefault: true },
            { name: 'fast', isDefault: false },
        ])

        expect(plan.cleared).toEqual(['standard'])
        expect(plan.patches).toEqual([
            { name: 'standard', isDefault: false },
            { name: 'fast', isDefault: true },
        ])
    })

    it('clears every default when a cluster has several, leaving exactly one', () => {
        const plan = DefaultClassService.plan(target('fast'), true, [
            { name: 'standard', isDefault: true },
            { name: 'legacy', isDefault: true },
            { name: 'fast', isDefault: false },
            { name: 'slow', isDefault: false },
        ])

        expect(plan.cleared).toEqual(['standard', 'legacy'])
        expect(plan.patches.filter(patch => patch.isDefault).map(patch => patch.name)).toEqual(['fast'])
    })

    it('clears nothing when no class is the default yet', () => {
        const plan = DefaultClassService.plan(target('fast'), true, [
            { name: 'standard', isDefault: false },
            { name: 'fast', isDefault: false },
        ])

        expect(plan.cleared).toEqual([])
        expect(plan.patches).toEqual([{ name: 'fast', isDefault: true }])
    })

    it('does not clear the class it is making the default', () => {
        const plan = DefaultClassService.plan(target('fast'), true, [{ name: 'fast', isDefault: true }])

        expect(plan.cleared).toEqual([])
        expect(plan.patches).toEqual([{ name: 'fast', isDefault: true }])
    })

    it('touches only the class itself when unsetting', () => {
        const plan = DefaultClassService.plan(target('fast'), false, [
            { name: 'standard', isDefault: true },
            { name: 'fast', isDefault: true },
        ])

        expect(plan.cleared).toEqual([])
        expect(plan.patches).toEqual([{ name: 'fast', isDefault: false }])
    })
})

describe('DefaultClassService.prepare', () => {
    beforeEach(() => {
        transport.reset()
        service = new DefaultClassService(connectionService, new ResourceListService(connectionService))
    })

    it('reads the current defaults from the cluster, not from what a filtered list shows', async () => {
        transport.answerWith(classList({ standard: true, fast: undefined, legacy: false }))

        const plan = await service.prepare(target('fast'), true)

        expect(transport.last.url).toBe('/apis/storage.k8s.io/v1/storageclasses')
        expect(plan.cleared).toEqual(['standard'])
    })

    it('reads an ingress class flag off its own annotation', async () => {
        transport.answerWith(classList({ nginx: true, traefik: undefined }, IngressClassEntity.defaultAnnotation))

        const plan = await service.prepare(target('traefik', ingressClasses), true)

        expect(transport.last.url).toBe('/apis/networking.k8s.io/v1/ingressclasses')
        expect(plan.cleared).toEqual(['nginx'])
    })

    it('asks the cluster nothing to unset a default', async () => {
        await service.prepare(target('standard'), false)

        expect(transport.requests).toHaveLength(0)
    })
})

describe('DefaultClassService.apply', () => {
    beforeEach(() => {
        transport.reset()
        service = new DefaultClassService(connectionService, new ResourceListService(connectionService))
    })

    it('writes "false" on the previous default, then "true" on the new one', async () => {
        await service.apply(DefaultClassService.plan(target('fast'), true, [{ name: 'standard', isDefault: true }]))

        expect(patches()).toEqual([
            { url: '/apis/storage.k8s.io/v1/storageclasses/standard', body: storageFlag('false') },
            { url: '/apis/storage.k8s.io/v1/storageclasses/fast', body: storageFlag('true') },
        ])
    })

    it('sends a merge patch carrying the annotation and nothing else', async () => {
        await service.apply(DefaultClassService.plan(target('standard'), false, []))

        expect(transport.last.headers?.['content-type']).toBe(KubePatchRequestFactory.mergePatchType)
        expect(transport.last.body).toEqual(storageFlag('false'))
    })

    it('uses the ingress class annotation for an ingress class', async () => {
        await service.apply(DefaultClassService.plan(target('nginx', ingressClasses), true, []))

        expect(transport.last.url).toBe('/apis/networking.k8s.io/v1/ingressclasses/nginx')
        expect(transport.last.body).toEqual({
            metadata: { annotations: { [IngressClassEntity.defaultAnnotation]: 'true' } },
        })
    })

    it('stops at the first refusal and does not set a default it could not clear the way for', async () => {
        transport.failWith(new Error('forbidden'))

        await expect(service.apply(
            DefaultClassService.plan(target('fast'), true, [{ name: 'standard', isDefault: true }]),
        )).rejects.toThrow('forbidden')

        expect(transport.requests).toHaveLength(1)
    })
})
