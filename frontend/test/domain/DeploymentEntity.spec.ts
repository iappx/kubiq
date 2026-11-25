import { describe, expect, it } from 'vitest'
import { DeploymentEntity } from '@/domain/entities/workloads'
import { KubeObjectFixtures } from '../support/fixtures/KubeObjectFixtures'

const build = (object: Record<string, any>): DeploymentEntity =>
    DeploymentEntity.build(KubeObjectFixtures.withUid(object))

describe('DeploymentEntity', () => {
    it('exposes the column values the registry names', () => {
        const deployment = build(KubeObjectFixtures.deployment())

        expect(deployment.name).toBe('web')
        expect(deployment.namespace).toBe('default')
        expect(deployment.readyText).toBe('3/3')
        expect(deployment.updatedReplicas).toBe(3)
        expect(deployment.availableReplicas).toBe(3)
    })

    it('is healthy when every replica is ready', () => {
        expect(build(KubeObjectFixtures.deployment()).state).toBe('ok')
    })

    it('is a warning while only some replicas are ready', () => {
        const source = KubeObjectFixtures.deployment()
        source.status.readyReplicas = 1

        const deployment = build(source)

        expect(deployment.readyText).toBe('1/3')
        expect(deployment.state).toBe('warning')
        expect(deployment.isProblematic).toBe(true)
    })

    it('is an error when nothing is ready', () => {
        const source = KubeObjectFixtures.deployment()
        source.status.readyReplicas = 0

        expect(build(source).state).toBe('error')
    })

    it('is an error when it stopped progressing', () => {
        const source = KubeObjectFixtures.deployment()
        source.status.conditions = [{ type: 'Progressing', status: 'False', reason: 'ProgressDeadlineExceeded' }]

        expect(build(source).state).toBe('error')
    })

    it('reads a deliberate scale to zero as healthy', () => {
        const source = KubeObjectFixtures.deployment()
        source.spec.replicas = 0
        source.status = { replicas: 0, observedGeneration: 4 }

        const deployment = build(source)

        expect(deployment.readyText).toBe('0/0')
        expect(deployment.state).toBe('ok')
    })

    it('defaults a missing replica count to one, the way the API server does', () => {
        const source = KubeObjectFixtures.deployment()
        delete source.spec.replicas

        expect(build(source).desiredReplicas).toBe(1)
    })

    it('reports pending and Progressing during a 1-replica rollout with zero ready pods', () => {
        const source = KubeObjectFixtures.deployment()
        source.spec.replicas = 1
        source.status = {
            replicas: 1,
            readyReplicas: 0,
            availableReplicas: 0,
            unavailableReplicas: 1,
            updatedReplicas: 1,
            observedGeneration: 4,
            conditions: [
                { type: 'Available', status: 'False', reason: 'MinimumReplicasUnavailable' },
                { type: 'Progressing', status: 'True', reason: 'ReplicaSetUpdated' },
            ],
        }

        const deployment = build(source)

        expect(deployment.isProgressing).toBe(true)
        expect(deployment.state).toBe('pending')
        expect(deployment.stateLabel).toBe('Progressing')
        expect(deployment.isProblematic).toBe(false)
    })

    it('reports Progressing while observedGeneration lags behind metadata.generation', () => {
        const source = KubeObjectFixtures.deployment()
        source.metadata.generation = 5
        source.status.observedGeneration = 4
        source.status.readyReplicas = 0

        const deployment = build(source)

        expect(deployment.isProgressing).toBe(true)
        expect(deployment.state).toBe('pending')
        expect(deployment.stateLabel).toBe('Progressing')
    })

    it('reports Progressing when Progressing condition has no reason and replicas are not yet updated or available', () => {
        const source = KubeObjectFixtures.deployment()
        source.spec.replicas = 2
        source.status = {
            replicas: 2,
            readyReplicas: 1,
            updatedReplicas: 1,
            availableReplicas: 1,
            observedGeneration: 4,
            conditions: [{ type: 'Progressing', status: 'True' }],
        }

        const deployment = build(source)

        expect(deployment.isProgressing).toBe(true)
        expect(deployment.state).toBe('pending')
        expect(deployment.stateLabel).toBe('Progressing')
    })

    it('does not treat a reasonless Progressing condition as progressing once replicas are updated and available', () => {
        const source = KubeObjectFixtures.deployment()
        source.status.conditions = [{ type: 'Progressing', status: 'True' }]

        const deployment = build(source)

        expect(deployment.isProgressing).toBe(false)
        expect(deployment.state).toBe('ok')
        expect(deployment.stateLabel).toBe('Healthy')
    })

    it('stays an error when Progressing is False even if observedGeneration lags', () => {
        const source = KubeObjectFixtures.deployment()
        source.metadata.generation = 5
        source.status.observedGeneration = 4
        source.status.readyReplicas = 0
        source.status.conditions = [{ type: 'Progressing', status: 'False', reason: 'ProgressDeadlineExceeded' }]

        const deployment = build(source)

        expect(deployment.isProgressing).toBe(false)
        expect(deployment.state).toBe('error')
        expect(deployment.stateLabel).toBe('Error')
    })

    it('does not report Progressing when the deployment is paused', () => {
        const source = KubeObjectFixtures.deployment()
        source.spec.paused = true
        source.status.readyReplicas = 1
        source.status.conditions = [{ type: 'Progressing', status: 'True', reason: 'ReplicaSetUpdated' }]

        const deployment = build(source)

        expect(deployment.isProgressing).toBe(false)
        expect(deployment.state).toBe('warning')
        expect(deployment.stateLabel).toBe('Warning')
    })

    it('reports pending and Terminating while deleting', () => {
        const source = KubeObjectFixtures.deployment()
        source.metadata.deletionTimestamp = '2026-09-01T10:20:00Z'

        const deployment = build(source)

        expect(deployment.state).toBe('pending')
        expect(deployment.stateLabel).toBe('Terminating')
    })
})
