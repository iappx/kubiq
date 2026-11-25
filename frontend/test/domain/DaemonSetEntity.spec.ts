import { describe, expect, it } from 'vitest'
import { DaemonSetEntity } from '@/domain/entities/workloads'
import { KubeObjectFixtures } from '../support/fixtures/KubeObjectFixtures'

const build = (object: Record<string, any>): DaemonSetEntity =>
    DaemonSetEntity.build(KubeObjectFixtures.withUid(object))

const baseDaemonSet = (): Record<string, any> => ({
    apiVersion: 'apps/v1',
    kind: 'DaemonSet',
    metadata: {
        name: 'node-exporter',
        namespace: 'monitoring',
        uid: 'ds-1111-2222-3333',
        generation: 2,
        creationTimestamp: '2026-08-20T09:00:00Z',
    },
    spec: {},
    status: {
        desiredNumberScheduled: 3,
        currentNumberScheduled: 3,
        numberReady: 3,
        updatedNumberScheduled: 3,
        numberMisscheduled: 0,
        observedGeneration: 2,
    },
})

describe('DaemonSetEntity', () => {
    it('is healthy when all desired pods are ready and updated', () => {
        const ds = build(baseDaemonSet())

        expect(ds.readyText).toBe('3/3')
        expect(ds.isProgressing).toBe(false)
        expect(ds.state).toBe('ok')
        expect(ds.stateLabel).toBe('Healthy')
        expect(ds.isProblematic).toBe(false)
    })

    it('reports pending and Progressing during rollout when observedGeneration lags', () => {
        const source = baseDaemonSet()
        source.metadata.generation = 3
        source.status.observedGeneration = 2
        source.status.numberReady = 0

        const ds = build(source)

        expect(ds.isProgressing).toBe(true)
        expect(ds.state).toBe('pending')
        expect(ds.stateLabel).toBe('Progressing')
        expect(ds.isProblematic).toBe(false)
    })

    it('reports pending and Progressing while updatedNumberScheduled is below desiredNumberScheduled', () => {
        const source = baseDaemonSet()
        source.status.numberReady = 0
        source.status.updatedNumberScheduled = 1

        const ds = build(source)

        expect(ds.isProgressing).toBe(true)
        expect(ds.state).toBe('pending')
        expect(ds.stateLabel).toBe('Progressing')
        expect(ds.isProblematic).toBe(false)
    })

    it('reports error when no pods are ready and no rollout is in progress', () => {
        const source = baseDaemonSet()
        source.status.numberReady = 0

        const ds = build(source)

        expect(ds.isProgressing).toBe(false)
        expect(ds.state).toBe('error')
        expect(ds.stateLabel).toBe('Error')
        expect(ds.isProblematic).toBe(true)
    })

    it('reports warning when only some pods are ready at steady state', () => {
        const source = baseDaemonSet()
        source.status.numberReady = 2

        const ds = build(source)

        expect(ds.isProgressing).toBe(false)
        expect(ds.state).toBe('warning')
        expect(ds.stateLabel).toBe('Warning')
    })

    it('reports warning when pods are misscheduled', () => {
        const source = baseDaemonSet()
        source.status.numberMisscheduled = 1
        source.status.updatedNumberScheduled = 1

        const ds = build(source)

        expect(ds.state).toBe('warning')
        expect(ds.stateLabel).toBe('Warning')
    })

    it('is healthy when desiredNumberScheduled is zero', () => {
        const source = baseDaemonSet()
        source.status.desiredNumberScheduled = 0
        source.status.numberReady = 0
        source.status.updatedNumberScheduled = 0

        const ds = build(source)

        expect(ds.state).toBe('ok')
        expect(ds.stateLabel).toBe('Healthy')
    })

    it('reports pending and Terminating while deleting', () => {
        const source = baseDaemonSet()
        source.metadata.deletionTimestamp = '2026-09-01T10:20:00Z'

        const ds = build(source)

        expect(ds.state).toBe('pending')
        expect(ds.stateLabel).toBe('Terminating')
    })
})
