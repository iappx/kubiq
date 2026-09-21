import { describe, expect, it } from 'vitest'
import { KubeChannelSupport } from '@/domain/models/kube/discovery/KubeChannelSupport'
import { KubeServerVersion } from '@/domain/models/kube/discovery/KubeServerVersion'

describe('KubeServerVersion', () => {
    it('reads the numbers the cluster reports', () => {
        const version = KubeServerVersion.read({ major: '1', minor: '31', gitVersion: 'v1.31.2' })

        expect(version.major).toBe(1)
        expect(version.minor).toBe(31)
        expect(version.text).toBe('v1.31.2')
        expect(version.short).toBe('1.31')
        expect(version.isKnown).toBe(true)
    })

    it('ignores the plus a managed distribution appends to the minor', () => {
        const version = KubeServerVersion.read({ major: '1', minor: '30+', gitVersion: 'v1.30.4-gke.1234' })

        expect(version.minor).toBe(30)
        expect(version.text).toBe('v1.30.4-gke.1234')
    })

    it('falls back to gitVersion when the numbers are missing', () => {
        const version = KubeServerVersion.read({ gitVersion: 'v1.29.7' })

        expect(version.major).toBe(1)
        expect(version.minor).toBe(29)
    })

    it('builds a label when only the numbers came back', () => {
        expect(KubeServerVersion.read({ major: '1', minor: '28' }).text).toBe('v1.28')
    })

    it('is unknown when the document says nothing usable', () => {
        const cases = [undefined, null, {}, { major: 'x', minor: 'y' }, { gitVersion: 'unversioned' }]

        cases.forEach((document) => {
            const version = KubeServerVersion.read(document)
            expect(version.isKnown).toBe(false)
            expect(version.short).toBe(KubeServerVersion.unknownText)
        })
    })

    describe('atLeast', () => {
        it('compares the major before the minor', () => {
            expect(new KubeServerVersion(2, 0, 'v2.0').atLeast(1, 30)).toBe(true)
            expect(new KubeServerVersion(0, 99, 'v0.99').atLeast(1, 30)).toBe(false)
        })

        it('accepts the minimum itself', () => {
            expect(new KubeServerVersion(1, 30, 'v1.30.0').atLeast(1, 30)).toBe(true)
        })

        it('refuses one minor below', () => {
            expect(new KubeServerVersion(1, 29, 'v1.29.9').atLeast(1, 30)).toBe(false)
        })

        it('is never true for a version nobody reported', () => {
            expect(KubeServerVersion.unknown().atLeast(1, 30)).toBe(false)
        })
    })
})

describe('KubeChannelSupport', () => {
    it('allows a cluster at the minimum or above', () => {
        expect(KubeChannelSupport.isSupported(new KubeServerVersion(1, 30, 'v1.30.0'))).toBe(true)
        expect(KubeChannelSupport.reason(new KubeServerVersion(1, 33, 'v1.33.0'))).toBe('')
    })

    it('says which version is running and what to use instead', () => {
        const reason = KubeChannelSupport.reason(new KubeServerVersion(1, 27, 'v1.27.9'))

        expect(reason).toContain('1.30 or newer')
        expect(reason).toContain('1.27')
        expect(reason).toContain('kubectl exec')
        expect(reason).toContain('kubectl port-forward')
    })

    it('tells the user what to check when the version is unknown', () => {
        const reason = KubeChannelSupport.reason(KubeServerVersion.unknown())

        expect(reason).toContain('/version')
        expect(reason).toContain('1.30')
    })
})
