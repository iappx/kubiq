import { describe, expect, it } from 'vitest'
import { PersistentVolumeClaimEntity } from '@/domain/entities/storage'
import { KubeObjectFixtures } from '../support/fixtures/KubeObjectFixtures'

const build = (object: Record<string, any>): PersistentVolumeClaimEntity =>
    PersistentVolumeClaimEntity.build(KubeObjectFixtures.withUid(object))

describe('PersistentVolumeClaimEntity', () => {
    it('exposes the column values the registry names', () => {
        const claim = build(KubeObjectFixtures.boundPersistentVolumeClaim())

        expect(claim.name).toBe('data-queue-0')
        expect(claim.requestedStorage).toBe('10Gi')
        expect(claim.allocatedStorage).toBe('10Gi')
        expect(claim.storageClassName).toBe('standard')
        expect(claim.volumeName).toBe('pvc-11112222-3333')
        expect(claim.accessModesText).toBe('RWO')
    })

    it('maps each phase onto a state', () => {
        const source = KubeObjectFixtures.boundPersistentVolumeClaim()
        const withPhase = (phase: string): string => {
            const next = KubeObjectFixtures.boundPersistentVolumeClaim()
            next.status.phase = phase
            return build(next).state
        }

        expect(build(source).state).toBe('ok')
        expect(withPhase('Pending')).toBe('pending')
        expect(withPhase('Lost')).toBe('error')
    })

    it('is unknown when the cluster reports no phase', () => {
        const source = KubeObjectFixtures.boundPersistentVolumeClaim()
        delete source.status.phase

        expect(build(source).state).toBe('unknown')
    })
})
