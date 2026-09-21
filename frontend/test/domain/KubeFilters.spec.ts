import { describe, expect, it } from 'vitest'
import { FilterFactory } from '@iappx/entity-repo-query'
import { KubeFilters, KubeSelectorPath } from '@/domain/entities/kube'
import { EventFilters, NamespaceFilters, NodeFilters } from '@/domain/entities/cluster'
import { SecretFilters } from '@/domain/entities/config'
import { PodEntity, PodFilters } from '@/domain/entities/workloads'

const filter = new FilterFactory<PodEntity>()

describe('KubeFilters', () => {
    it('compiles a name to the path the API server accepts in a fieldSelector', () => {
        expect(KubeFilters.named(filter, 'web')).toEqual({
            kind: 'comparison',
            path: ['metadata', 'name'],
            operator: 'eq',
            value: 'web',
        })
    })

    it('compiles a namespace the same way', () => {
        expect(KubeFilters.inNamespace(filter, 'default')).toEqual({
            kind: 'comparison',
            path: ['metadata', 'namespace'],
            operator: 'eq',
            value: 'default',
        })
    })

    it('puts a label under the path a compiler routes to labelSelector', () => {
        const node = KubeFilters.withLabel(filter, 'app', 'web')

        expect(node).toEqual({
            kind: 'comparison',
            path: ['metadata', 'labels', 'app'],
            operator: 'eq',
            value: 'web',
        })
        expect(KubeSelectorPath.isLabelPath(['metadata', 'labels', 'app'])).toBe(true)
        expect(KubeSelectorPath.labelKey(['metadata', 'labels', 'app'])).toBe('app')
    })

    it('ands several labels together', () => {
        const node = KubeFilters.withLabels(filter, { app: 'web', tier: 'front' })

        expect(node).toMatchObject({ kind: 'logical', operator: 'and' })
        expect((node as { nodes: unknown[] }).nodes).toHaveLength(2)
    })

    it('collapses a single label to the bare condition', () => {
        expect(KubeFilters.withLabels(filter, { app: 'web' })).toMatchObject({ kind: 'comparison' })
    })

    it('tells a label path apart from a field path', () => {
        expect(KubeSelectorPath.isLabelPath(['spec', 'nodeName'])).toBe(false)
        expect(KubeSelectorPath.labelKey(['spec', 'nodeName'])).toBeUndefined()
        expect(KubeSelectorPath.fieldName(['spec', 'nodeName'])).toBe('spec.nodeName')
    })
})

describe('PodFilters', () => {
    it('selects by node through spec.nodeName', () => {
        expect(PodFilters.onNode(filter, 'worker-1')).toMatchObject({
            path: ['spec', 'nodeName'],
            operator: 'eq',
            value: 'worker-1',
        })
    })

    it('selects by phase through status.phase', () => {
        expect(PodFilters.running(filter)).toMatchObject({ path: ['status', 'phase'], value: 'Running' })
        expect(PodFilters.failed(filter)).toMatchObject({ path: ['status', 'phase'], value: 'Failed' })
    })

    it('selects by service account', () => {
        expect(PodFilters.ofServiceAccount(filter, 'builder')).toMatchObject({
            path: ['spec', 'serviceAccountName'],
            value: 'builder',
        })
    })

    it('combines named rules with and, never with or', () => {
        const node = PodFilters.runningOnNode(filter, 'worker-1')

        expect(node).toMatchObject({ kind: 'logical', operator: 'and' })
        expect((node as { nodes: unknown[] }).nodes).toHaveLength(2)
    })

    it('scopes a node filter to a namespace', () => {
        const node = PodFilters.onNodeInNamespace(filter, 'worker-1', 'default')

        expect((node as { nodes: { path: string[] }[] }).nodes.map(p => p.path)).toEqual([
            ['spec', 'nodeName'],
            ['metadata', 'namespace'],
        ])
    })
})

describe('the other named rules', () => {
    it('selects nodes by schedulability', () => {
        expect(NodeFilters.schedulable(filter)).toMatchObject({ path: ['spec', 'unschedulable'], value: false })
        expect(NodeFilters.cordoned(filter)).toMatchObject({ path: ['spec', 'unschedulable'], value: true })
    })

    it('selects a node role through its marker label', () => {
        expect(NodeFilters.withRole(filter, 'worker')).toMatchObject({
            path: ['metadata', 'labels', 'node-role.kubernetes.io/worker'],
            value: '',
        })
    })

    it('selects active namespaces', () => {
        expect(NamespaceFilters.active(filter)).toMatchObject({ path: ['status', 'phase'], value: 'Active' })
    })

    it('selects secrets by type', () => {
        expect(SecretFilters.ofType(filter, 'kubernetes.io/tls')).toMatchObject({
            path: ['type'],
            value: 'kubernetes.io/tls',
        })
    })

    it('selects events by type and by the object they concern', () => {
        expect(EventFilters.warnings(filter)).toMatchObject({ path: ['type'], value: 'Warning' })
        expect(EventFilters.forObject(filter, 'uid-1')).toMatchObject({
            path: ['involvedObject', 'uid'],
            value: 'uid-1',
        })

        const byName = EventFilters.forObjectName(filter, 'Pod', 'queue-0')

        expect((byName as { nodes: { path: string[] }[] }).nodes.map(p => p.path)).toEqual([
            ['involvedObject', 'kind'],
            ['involvedObject', 'name'],
        ])
    })
})
