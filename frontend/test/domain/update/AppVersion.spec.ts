import { describe, expect, it } from 'vitest'
import { AppVersion } from '@/domain/models/update'

describe('AppVersion', () => {
    it('reads a release tag with or without its leading v', () => {
        expect(AppVersion.parse('v1.12.3')?.toString()).toBe('1.12.3')
        expect(AppVersion.parse('0.2.0')?.toString()).toBe('0.2.0')
        expect(AppVersion.parse(' V2.0.1 ')?.toString()).toBe('2.0.1')
    })

    it.each([
        ['a suffix', '1.2.3-rc.1'],
        ['two numbers', '1.2'],
        ['words', 'latest'],
        ['nothing', ''],
    ])('refuses %s', (_name, value) => {
        expect(AppVersion.parse(value)).toBeNull()
    })

    it('compares numerically, not as text', () => {
        expect(AppVersion.isNewer('0.10.0', '0.9.9')).toBe(true)
        expect(AppVersion.isNewer('1.0.0', '0.99.99')).toBe(true)
        expect(AppVersion.isNewer('0.2.1', '0.2.0')).toBe(true)
    })

    it('does not call the same or an older version newer', () => {
        expect(AppVersion.isNewer('v0.2.0', '0.2.0')).toBe(false)
        expect(AppVersion.isNewer('0.1.9', '0.2.0')).toBe(false)
    })

    it('does not call anything newer when either side cannot be read', () => {
        expect(AppVersion.isNewer('nightly', '0.2.0')).toBe(false)
        expect(AppVersion.isNewer('0.3.0', 'dev')).toBe(false)
    })
})
