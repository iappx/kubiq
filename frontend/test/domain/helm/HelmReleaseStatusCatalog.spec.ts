import { describe, expect, it } from 'vitest'
import { HelmReleaseStatusCatalog } from '@/domain/entities/helm/HelmReleaseStatusCatalog'
import { HelmReleaseKey } from '@/domain/models/helm/HelmReleaseKey'

describe('HelmReleaseStatusCatalog', () => {
    it('titles every status helm can report', () => {
        expect(HelmReleaseStatusCatalog.title('deployed')).toBe('Deployed')
        expect(HelmReleaseStatusCatalog.title('pending-upgrade')).toBe('Pending upgrade')
    })

    it('reads a status it does not know as unknown', () => {
        expect(HelmReleaseStatusCatalog.parse('DEPLOYED')).toBe('deployed')
        expect(HelmReleaseStatusCatalog.parse('invented')).toBe('unknown')
        expect(HelmReleaseStatusCatalog.parse(7)).toBe('unknown')
    })

    it('knows which statuses mean helm is still working', () => {
        expect(HelmReleaseStatusCatalog.isPending('pending-rollback')).toBe(true)
        expect(HelmReleaseStatusCatalog.isPending('uninstalling')).toBe(true)
        expect(HelmReleaseStatusCatalog.isPending('deployed')).toBe(false)
    })

    it('knows which statuses still hold something in the cluster', () => {
        expect(HelmReleaseStatusCatalog.isLive('deployed')).toBe(true)
        expect(HelmReleaseStatusCatalog.isLive('superseded')).toBe(false)
        expect(HelmReleaseStatusCatalog.isLive('uninstalled')).toBe(false)
    })
})

describe('HelmReleaseKey', () => {
    it('keys a release by its namespace and name, and reads the key back', () => {
        expect(HelmReleaseKey.of('dev', 'web')).toBe('dev/web')
        expect(HelmReleaseKey.parse('dev/web')).toEqual({ namespace: 'dev', name: 'web' })
    })

    it('keys a revision by its release and number', () => {
        expect(HelmReleaseKey.forRevision('dev', 'web', 3)).toBe('dev/web@3')
    })

    it('reads a key with no namespace as a bare name', () => {
        expect(HelmReleaseKey.parse('web')).toEqual({ namespace: '', name: 'web' })
    })
})
