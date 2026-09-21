import { describe, expect, it } from 'vitest'
import { ObjectMetaEntity, OwnerReferenceEntity } from '@/domain/entities/kube'
import { KubeObjectFixtures } from '../support/fixtures/KubeObjectFixtures'

describe('ObjectMetaEntity', () => {
    it('builds the owner references as nested entities', () => {
        const meta = ObjectMetaEntity.build(KubeObjectFixtures.runningPod().metadata)

        expect(meta.ownerReferences).toHaveLength(1)
        expect(meta.ownerReferences[0]).toBeInstanceOf(OwnerReferenceEntity)
        expect(meta.ownerReferences[0].kind).toBe('ReplicaSet')
    })

    it('finds the controlling owner', () => {
        const meta = ObjectMetaEntity.build(KubeObjectFixtures.runningPod().metadata)

        expect(meta.controller?.name).toBe('web-5d9f7c8b6')
    })

    it('has no controller when no owner claims to be one', () => {
        const meta = ObjectMetaEntity.build({
            uid: 'u',
            ownerReferences: [{ uid: 'o', kind: 'ReplicaSet', name: 'rs' }],
        })

        expect(meta.controller).toBeUndefined()
    })

    it('reads labels as pairs and by key', () => {
        const meta = ObjectMetaEntity.build(KubeObjectFixtures.runningPod().metadata)

        expect(meta.labelPairs).toEqual(['app=web', 'pod-template-hash=5d9f7c8b6'])
        expect(meta.label('app')).toBe('web')
        expect(meta.label('missing')).toBeUndefined()
    })

    it('survives an object with no labels at all', () => {
        const meta = ObjectMetaEntity.build({ uid: 'u', name: 'n' })

        expect(meta.labelPairs).toEqual([])
        expect(meta.annotation('anything')).toBeUndefined()
    })

    it('reports deletion from the timestamp the API server sets', () => {
        expect(ObjectMetaEntity.build({ uid: 'u' }).isDeleting).toBe(false)
        expect(ObjectMetaEntity.build({ uid: 'u', deletionTimestamp: '2026-09-01T10:20:00Z' }).isDeleting).toBe(true)
    })

    it('keeps metadata.uid in a serialised manifest', () => {
        const meta = ObjectMetaEntity.build(KubeObjectFixtures.runningPod().metadata)

        expect(meta.serialize().uid).toBe('0f1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9')
    })
})
