import { describe, expect, it } from 'vitest'
import { ClusterAppearanceEntity } from '@/domain/entities/catalog/ClusterAppearanceEntity'

const data = {
    clusterId: 'prod',
    displayName: 'Production',
    iconKind: 'glyph',
    initials: 'PR',
    color: 'red',
    glyph: 'shield',
    imagePath: '',
    updatedAt: 42,
}

describe('ClusterAppearanceEntity', () => {
    it('keys the record by the cluster id', () => {
        const entity = ClusterAppearanceEntity.build(data)

        expect(entity.clusterId).toBe('prod')
    })

    it('round-trips every field through its data values', () => {
        const entity = ClusterAppearanceEntity.build(data)

        expect(ClusterAppearanceEntity.build(entity.getDataValues()).getDataValues()).toEqual(data)
    })
})
