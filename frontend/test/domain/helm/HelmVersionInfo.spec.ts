import { describe, expect, it } from 'vitest'
import { HelmVersionInfo } from '@/domain/models/helm/HelmVersionInfo'

describe('HelmVersionInfo', () => {
    it('reads the version out of what helm version --short prints', () => {
        expect(HelmVersionInfo.parse('v3.14.0+g3fc9f4b\n')).toBe('v3.14.0+g3fc9f4b')
        expect(HelmVersionInfo.parse('3.14.0')).toBe('3.14.0')
    })

    it('keeps text it cannot read, instead of pretending there is no version', () => {
        expect(HelmVersionInfo.parse('  something else  ')).toBe('something else')
    })

    it('accepts Helm 3 and newer and refuses what came before it', () => {
        expect(HelmVersionInfo.isSupported('v3.14.0+g3fc9f4b')).toBe(true)
        expect(HelmVersionInfo.isSupported('v4.0.0')).toBe(true)
        expect(HelmVersionInfo.isSupported('v2.17.0')).toBe(false)
        expect(HelmVersionInfo.isSupported('nonsense')).toBe(false)
    })

    it('says which version it saw when it refuses one', () => {
        expect(HelmVersionInfo.unsupportedReason('v2.17.0')).toContain('v2.17.0')
    })
})
