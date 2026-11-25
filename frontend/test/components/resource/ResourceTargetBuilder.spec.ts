import { describe, expect, it } from 'vitest'
import { ResourceTargetBuilder } from '@/components/resource/ResourceTargetBuilder'
import type { TResourceRow } from '@/components/resource/types/TResourceRow'
import { KubeResourceRegistry } from '@/domain/models/kube'

const podsKind = KubeResourceRegistry.find('', 'pods')!
const nodesKind = KubeResourceRegistry.find('', 'nodes')!

const row = (name: string, namespace = 'default'): TResourceRow => ({
    key: namespace ? `${namespace}/${name}` : name,
    name,
    namespace,
    createdAt: '2026-01-01T00:00:00Z',
    tone: 'ok',
    statusTitle: 'Running',
    hasState: true,
})

describe('ResourceTargetBuilder', () => {
    it('builds a workload target when kind and row are present', () => {
        const pod = row('api-1', 'prod')

        expect(ResourceTargetBuilder.workloadOf('c1', podsKind, pod)).toEqual({
            clusterId: 'c1',
            kind: podsKind,
            name: 'api-1',
            namespace: 'prod',
            rowKey: 'prod/api-1',
        })
        expect(ResourceTargetBuilder.workloadOf('c1', null, pod)).toBeNull()
        expect(ResourceTargetBuilder.workloadOf('c1', podsKind, null)).toBeNull()
    })

    it('builds workload targets for multiple rows and returns empty without a kind', () => {
        const rows = [row('api-1', 'prod'), row('api-2', 'staging')]

        expect(ResourceTargetBuilder.workloadsOf('c1', podsKind, rows)).toEqual([
            { clusterId: 'c1', kind: podsKind, name: 'api-1', namespace: 'prod', rowKey: 'prod/api-1' },
            { clusterId: 'c1', kind: podsKind, name: 'api-2', namespace: 'staging', rowKey: 'staging/api-2' },
        ])
        expect(ResourceTargetBuilder.workloadsOf('c1', null, rows)).toEqual([])
    })

    it('builds node targets for single and multiple rows', () => {
        const nodeA = row('worker-a', '')
        const nodeB = row('worker-b', '')

        expect(ResourceTargetBuilder.nodeOf('c1', nodesKind, nodeA)).toEqual({
            clusterId: 'c1',
            kind: nodesKind,
            name: 'worker-a',
            rowKey: 'worker-a',
        })
        expect(ResourceTargetBuilder.nodeOf('c1', null, nodeA)).toBeNull()
        expect(ResourceTargetBuilder.nodeOf('c1', nodesKind, null)).toBeNull()
        expect(ResourceTargetBuilder.nodesOf('c1', nodesKind, [nodeA, nodeB])).toEqual([
            { clusterId: 'c1', kind: nodesKind, name: 'worker-a', rowKey: 'worker-a' },
            { clusterId: 'c1', kind: nodesKind, name: 'worker-b', rowKey: 'worker-b' },
        ])
        expect(ResourceTargetBuilder.nodesOf('c1', null, [nodeA])).toEqual([])
    })

    it('matches selected rows preserving list order', () => {
        const rows = [row('a'), row('b'), row('c')]

        expect(ResourceTargetBuilder.selectedRows(rows, ['default/c', 'default/a']).map(item => item.name)).toEqual([
            'a',
            'c',
        ])
        expect(ResourceTargetBuilder.selectedRows(rows, [])).toEqual([])
    })

    it('prunes selection keys missing from the current rows while preserving selection order', () => {
        const rows = [row('a'), row('c')]

        expect(ResourceTargetBuilder.pruneSelected(rows, ['default/c', 'default/b', 'default/a'])).toEqual([
            'default/c',
            'default/a',
        ])
        expect(ResourceTargetBuilder.pruneSelected(rows, [])).toEqual([])
    })

    it('detects whether a detail object is among target objects', () => {
        const targets = [
            { namespace: 'prod', name: 'api-1' },
            { namespace: '', name: 'worker-a' },
        ]

        expect(ResourceTargetBuilder.containsObject(targets, 'prod', 'api-1')).toBe(true)
        expect(ResourceTargetBuilder.containsObject(targets, 'staging', 'api-1')).toBe(false)
        expect(ResourceTargetBuilder.containsObject(targets, '', 'worker-a')).toBe(true)
        expect(ResourceTargetBuilder.containsObject(targets, '', '')).toBe(false)
    })
})
