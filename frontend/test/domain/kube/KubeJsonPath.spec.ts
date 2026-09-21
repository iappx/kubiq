import { describe, expect, it } from 'vitest'
import { KubeJsonPath } from '@/domain/models/kube'
import { KubeObjectFixtures } from '../../support/fixtures/KubeObjectFixtures'

describe('KubeJsonPath', () => {
    it('reads the paths a CRD printer column declares', () => {
        const object = KubeObjectFixtures.customResource()

        expect(KubeJsonPath.read(object, '.spec.secretName')).toBe('web-tls')
        expect(KubeJsonPath.read(object, '.metadata.creationTimestamp')).toBe('2026-08-25T12:00:00Z')
        expect(KubeJsonPath.read(object, '.spec.issuerRef.name')).toBe('letsencrypt')
    })

    it('walks array indices', () => {
        const object = KubeObjectFixtures.customResource()

        expect(KubeJsonPath.read(object, '.status.conditions[0].status')).toBe('True')
        expect(KubeJsonPath.read(object, '.spec.dnsNames[0]')).toBe('example.test')
    })

    it('returns undefined instead of throwing on a path that is not there', () => {
        const object = KubeObjectFixtures.customResource()

        expect(KubeJsonPath.read(object, '.status.missing.deeper')).toBeUndefined()
        expect(KubeJsonPath.read(object, '.status.conditions[9].status')).toBeUndefined()
        expect(KubeJsonPath.read(undefined, '.spec.secretName')).toBeUndefined()
    })

    it('parses the leading dollar and dot that the notation allows', () => {
        expect(KubeJsonPath.parse('$.spec.replicas')).toEqual(['spec', 'replicas'])
        expect(KubeJsonPath.parse('.spec.replicas')).toEqual(['spec', 'replicas'])
        expect(KubeJsonPath.parse('spec.replicas')).toEqual(['spec', 'replicas'])
        expect(KubeJsonPath.parse('.status.conditions[0].status')).toEqual(['status', 'conditions', '0', 'status'])
        expect(KubeJsonPath.parse('.')).toEqual([])
    })
})
