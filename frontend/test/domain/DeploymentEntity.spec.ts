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
})
