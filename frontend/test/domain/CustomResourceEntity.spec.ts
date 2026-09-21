import { describe, expect, it } from 'vitest'
import { CustomResourceEntity } from '@/domain/entities/kube'
import { KubeObjectFixtures } from '../support/fixtures/KubeObjectFixtures'

const build = (object: Record<string, any>): CustomResourceEntity =>
    CustomResourceEntity.build(KubeObjectFixtures.withUid(object))

describe('CustomResourceEntity', () => {
    it('carries an arbitrary spec and status through untouched', () => {
        const source = KubeObjectFixtures.customResource()
        const entity = build(source)

        expect(entity.kind).toBe('Certificate')
        expect(entity.apiVersion).toBe('cert-manager.io/v1')
        expect(entity.spec).toEqual(source.spec)
        expect(entity.serialize().status).toEqual(source.status)
        expect(entity.serialize().uid).toBeUndefined()
    })

    it('is healthy when the resource reports a Ready condition of its own', () => {
        const entity = build(KubeObjectFixtures.customResource())

        expect(entity.conditions).toHaveLength(1)
        expect(entity.state).toBe('ok')
        expect(entity.isProblematic).toBe(false)
    })

    it('is an error when Ready is false', () => {
        const source = KubeObjectFixtures.customResource()
        source.status.conditions = [{ type: 'Ready', status: 'False', reason: 'Issuing' }]

        const entity = build(source)

        expect(entity.state).toBe('error')
        expect(entity.isProblematic).toBe(true)
    })

    it('stays unknown when the CRD spells its conditions some other way', () => {
        const source = KubeObjectFixtures.customResource()
        source.status.conditions = [{ type: 'Synced', status: 'True' }]

        expect(build(source).state).toBe('unknown')
    })

    it('stays unknown when there is no status at all', () => {
        const source = KubeObjectFixtures.customResource()
        delete source.status

        const entity = build(source)

        expect(entity.conditions).toEqual([])
        expect(entity.state).toBe('unknown')
    })
})
