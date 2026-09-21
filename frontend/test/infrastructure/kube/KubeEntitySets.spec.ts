import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import { KubeEntitySets } from '@/infrastructure/entityRepo/kube/KubeEntitySets'
import { KubeQueryMeta } from '@/infrastructure/entityRepo/kube/KubeQueryMeta'
import { KubeResourceKind, KubeResourceRegistry } from '@/domain/models/kube'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'

const transport = new MemoryKubeTransport()

let context: KubeEntityContext

const contextOf = () => EntityRepo.create()
    .use(KubeEntityContext, transport as never)
    .getContext(KubeEntityContext)

describe('KubeEntitySets', () => {
    beforeEach(() => {
        transport.reset()
        context = contextOf()
    })

    it('finds the typed set a kind has an entity for', () => {
        expect(KubeEntitySets.keyOf(context, KubeResourceRegistry.find('', 'pods')!)).toBe('pods')
        expect(KubeEntitySets.keyOf(context, KubeResourceRegistry.find('apps', 'deployments')!)).toBe('deployments')
    })

    it('finds a typed set for every kind the context declares one for', () => {
        KubeResourceRegistry.all().forEach((kind) => {
            expect(KubeEntitySets.hasTypedSet(context, kind)).toBe(true)
        })
    })

    it('falls back to the generic set for a kind nothing is declared for', () => {
        const widgets = new KubeResourceKind({
            group: 'acme.example.com',
            version: 'v1',
            resource: 'widgets',
            kind: 'Widget',
            title: 'Widgets',
            namespaced: true,
            section: 'custom',
            icon: 'Puzzle',
            columns: [],
            verbs: ['list'],
        })

        expect(KubeEntitySets.keyOf(context, widgets)).toBeUndefined()
        expect(KubeEntitySets.hasTypedSet(context, widgets)).toBe(false)
    })

    it('never resolves a kind to the generic set by accident', () => {
        expect(KubeEntitySets.keyOf(context, KubeResourceRegistry.find('', 'nodes')!)).not.toBe('resources')
    })

    it('stamps the kind it was given onto the query, version included', async () => {
        const discovered = KubeResourceRegistry.find('apps', 'deployments')!.withDefinition({ version: 'v1beta2' })
        transport.answerWith({ items: [] })

        await KubeEntitySets.queryFor(context, discovered).getAll()

        expect(transport.path).toBe('/apis/apps/v1beta2/deployments')
    })

    it('addresses a kind with no typed set through the generic one', async () => {
        const widgets = new KubeResourceKind({
            group: 'acme.example.com',
            version: 'v1',
            resource: 'widgets',
            kind: 'Widget',
            title: 'Widgets',
            namespaced: true,
            section: 'custom',
            icon: 'Puzzle',
            columns: [],
            verbs: ['list'],
        })
        transport.answerWith({ items: [] })

        await KubeEntitySets.queryFor(context, widgets).getAll()

        expect(transport.path).toBe('/apis/acme.example.com/v1/widgets')
    })

    it('hands out a fresh query each time, so one screen cannot inherit another one filter', async () => {
        const pods = KubeResourceRegistry.find('', 'pods')!
        transport.answerWith({ items: [] })
        transport.answerWith({ items: [] })

        await KubeEntitySets.queryFor(context, pods).withPathParams({ namespace: 'payments' }).getAll()
        await KubeEntitySets.queryFor(context, pods).getAll()

        expect(transport.requests.map(request => request.url)).toEqual([
            '/api/v1/namespaces/payments/pods',
            '/api/v1/pods',
        ])
    })

    it('reads the kind back off the query it built', () => {
        const pods = KubeResourceRegistry.find('', 'pods')!

        expect(KubeQueryMeta.kindOf(KubeQueryMeta.forKind(pods))?.registryKey).toBe(pods.registryKey)
    })
})
