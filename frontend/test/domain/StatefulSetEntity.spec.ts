import { describe, expect, it } from 'vitest'
import { StatefulSetEntity } from '@/domain/entities/workloads'
import { KubeObjectFixtures } from '../support/fixtures/KubeObjectFixtures'

const build = (object: Record<string, any>): StatefulSetEntity =>
    StatefulSetEntity.build(KubeObjectFixtures.withUid(object))

const baseStatefulSet = (): Record<string, any> => ({
    apiVersion: 'apps/v1',
    kind: 'StatefulSet',
    metadata: {
        name: 'db',
        namespace: 'default',
        uid: 'sts-1111-2222-3333',
        generation: 3,
        creationTimestamp: '2026-08-20T09:00:00Z',
    },
    spec: {
        serviceName: 'db',
        replicas: 1,
    },
    status: {
        replicas: 1,
        readyReplicas: 1,
        currentReplicas: 1,
        updatedReplicas: 1,
        observedGeneration: 3,
        currentRevision: 'db-rev3',
        updateRevision: 'db-rev3',
    },
})

describe('StatefulSetEntity', () => {
    it('is healthy when all replicas are ready and revisions match', () => {
        const sts = build(baseStatefulSet())

        expect(sts.readyText).toBe('1/1')
        expect(sts.isProgressing).toBe(false)
        expect(sts.state).toBe('ok')
        expect(sts.stateLabel).toBe('Healthy')
        expect(sts.isProblematic).toBe(false)
    })

    it('reports pending and Progressing during a 1-replica rollout when revisions differ', () => {
        const source = baseStatefulSet()
        source.status.readyReplicas = 0
        source.status.currentRevision = 'db-rev2'
        source.status.updateRevision = 'db-rev3'

        const sts = build(source)

        expect(sts.isProgressing).toBe(true)
        expect(sts.state).toBe('pending')
        expect(sts.stateLabel).toBe('Progressing')
        expect(sts.isProblematic).toBe(false)
    })

    it('reports pending and Progressing when observedGeneration lags behind metadata.generation', () => {
        const source = baseStatefulSet()
        source.metadata.generation = 4
        source.status.observedGeneration = 3
        source.status.readyReplicas = 0

        const sts = build(source)

        expect(sts.isProgressing).toBe(true)
        expect(sts.state).toBe('pending')
        expect(sts.stateLabel).toBe('Progressing')
    })

    it('reports pending and Progressing while updatedReplicas is below desiredReplicas', () => {
        const source = baseStatefulSet()
        source.spec.replicas = 3
        source.status.readyReplicas = 1
        source.status.updatedReplicas = 1

        const sts = build(source)

        expect(sts.isProgressing).toBe(true)
        expect(sts.state).toBe('pending')
        expect(sts.stateLabel).toBe('Progressing')
    })

    it('reports error when no replicas are ready and no rollout is in progress', () => {
        const source = baseStatefulSet()
        source.status.readyReplicas = 0

        const sts = build(source)

        expect(sts.isProgressing).toBe(false)
        expect(sts.state).toBe('error')
        expect(sts.stateLabel).toBe('Error')
        expect(sts.isProblematic).toBe(true)
    })

    it('reports warning when only some replicas are ready at steady state', () => {
        const source = baseStatefulSet()
        source.spec.replicas = 3
        source.status.readyReplicas = 1
        source.status.updatedReplicas = 3

        const sts = build(source)

        expect(sts.isProgressing).toBe(false)
        expect(sts.state).toBe('warning')
        expect(sts.stateLabel).toBe('Warning')
        expect(sts.isProblematic).toBe(true)
    })

    it('reads a scale to zero as healthy', () => {
        const source = baseStatefulSet()
        source.spec.replicas = 0
        source.status = { replicas: 0, observedGeneration: 3 }

        const sts = build(source)

        expect(sts.readyText).toBe('0/0')
        expect(sts.state).toBe('ok')
        expect(sts.stateLabel).toBe('Healthy')
    })

    it('reports pending and Terminating while deleting', () => {
        const source = baseStatefulSet()
        source.metadata.deletionTimestamp = '2026-09-01T10:20:00Z'

        const sts = build(source)

        expect(sts.state).toBe('pending')
        expect(sts.stateLabel).toBe('Terminating')
    })
})
