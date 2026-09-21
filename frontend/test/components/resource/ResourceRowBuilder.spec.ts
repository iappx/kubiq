import { describe, expect, it } from 'vitest'
import { ResourceRowBuilder } from '@/components/resource/ResourceRowBuilder'
import { CustomResourceEntity } from '@/domain/entities/kube'
import { PodEntity } from '@/domain/entities/workloads'
import { KubeResourceRegistry } from '@/domain/models/kube'
import type { TKubeColumn } from '@/domain/models/kube'

const pods = KubeResourceRegistry.find('', 'pods')!

const pod = (name: string, uid: string) => PodEntity.build({
    uid,
    metadata: { uid, name, namespace: 'payments', creationTimestamp: '2026-09-01T10:00:00Z' },
    spec: { nodeName: 'node-a', containers: [{ name: 'app' }] },
    status: {
        phase: 'Running',
        containerStatuses: [{ name: 'app', ready: true, restartCount: 3, state: { running: {} } }],
    },
})

describe('ResourceRowBuilder', () => {
    it('reads the fixed fields every kind has', () => {
        const [row] = ResourceRowBuilder.build([pod('api-0', 'uid-1')], pods.columns)

        expect(row).toMatchObject({
            key: 'uid-1',
            name: 'api-0',
            namespace: 'payments',
            createdAt: '2026-09-01T10:00:00Z',
        })
    })

    it('reads a computed column off the entity that declares it', () => {
        const [row] = ResourceRowBuilder.build([pod('api-0', 'uid-1')], pods.columns)

        expect(row.readyText).toBe('1/1')
        expect(row.restartCount).toBe(3)
        expect(row.nodeName).toBe('node-a')
    })

    it('carries the state as a tone and as the word beside it', () => {
        const [row] = ResourceRowBuilder.build([pod('api-0', 'uid-1')], pods.columns)

        expect(row.tone).toBe('ok')
        expect(row.statusTitle).toBe('Healthy')
    })

    it('falls back to namespace and name when the object carries no uid', () => {
        const entity = CustomResourceEntity.build({
            metadata: { name: 'widget-a', namespace: 'lab' },
        })

        expect(ResourceRowBuilder.keyOf(entity)).toBe('lab/widget-a')
    })

    it('keys a cluster-scoped object by its name alone', () => {
        const entity = CustomResourceEntity.build({ metadata: { name: 'widget-a' } })

        expect(ResourceRowBuilder.keyOf(entity)).toBe('widget-a')
    })

    it('builds a row for a kind with no entity of its own', () => {
        const entity = CustomResourceEntity.build({
            uid: 'uid-9',
            metadata: { uid: 'uid-9', name: 'widget-a', namespace: 'lab', creationTimestamp: '2026-09-02T08:00:00Z' },
            status: {},
        })
        const columns: TKubeColumn[] = [
            { key: 'name', title: 'Name' },
            { key: 'namespace', title: 'Namespace' },
            { key: 'state', title: 'Status' },
            { key: 'createdAt', title: 'Age' },
        ]

        const [row] = ResourceRowBuilder.build([entity], columns)

        expect(row).toMatchObject({
            key: 'uid-9',
            name: 'widget-a',
            namespace: 'lab',
            createdAt: '2026-09-02T08:00:00Z',
            tone: 'unknown',
            statusTitle: 'Unknown',
        })
    })

    it('reads a CRD printer column by its jsonPath', () => {
        const entity = CustomResourceEntity.build({
            metadata: { name: 'widget-a' },
            status: { phase: 'Bound' },
        })
        const columns: TKubeColumn[] = [{ key: 'Phase', title: 'Phase', jsonPath: '.status.phase' }]

        expect(ResourceRowBuilder.build([entity], columns)[0].Phase).toBe('Bound')
    })

    it('leaves a jsonPath that resolves to nothing undefined rather than guessing', () => {
        const entity = CustomResourceEntity.build({ metadata: { name: 'widget-a' }, status: {} })
        const columns: TKubeColumn[] = [{ key: 'Phase', title: 'Phase', jsonPath: '.status.phase' }]

        expect(ResourceRowBuilder.build([entity], columns)[0].Phase).toBeUndefined()
    })

    it('answers unknown for an object with no state at all', () => {
        const entity = CustomResourceEntity.build({ metadata: { name: 'widget-a' } })

        expect(ResourceRowBuilder.toneOf(entity)).toBe('unknown')
    })

    it('builds nothing from nothing', () => {
        expect(ResourceRowBuilder.build([], pods.columns)).toEqual([])
    })
})
