import { describe, expect, it } from 'vitest'
import { KubeIconResolver } from '@/components/common/icon/KubeIconResolver'
import { KubeCrdReader, KubeResourceRegistry } from '@/domain/models/kube'

describe('KubeIconResolver', () => {
    it('resolves every icon the registry names', () => {
        for (const kind of KubeResourceRegistry.all()) {
            expect(KubeIconResolver.has(kind.icon)).toBe(true)
            expect(KubeIconResolver.resolve(kind.icon)).not.toBe(KubeIconResolver.fallback)
        }
    })

    it('resolves the icon a discovered custom resource gets', () => {
        expect(KubeIconResolver.has(KubeCrdReader.icon)).toBe(true)
    })

    it('falls back to a neutral glyph for a name it does not know', () => {
        expect(KubeIconResolver.resolve('NotAnIcon')).toBe(KubeIconResolver.fallback)
        expect(KubeIconResolver.has('NotAnIcon')).toBe(false)
    })

    it('falls back rather than throwing on an absent name', () => {
        expect(KubeIconResolver.resolve('')).toBe(KubeIconResolver.fallback)
        expect(KubeIconResolver.resolve(null)).toBe(KubeIconResolver.fallback)
        expect(KubeIconResolver.resolve(undefined)).toBe(KubeIconResolver.fallback)
    })

    it('does not resolve an inherited object property as an icon', () => {
        expect(KubeIconResolver.resolve('constructor')).toBe(KubeIconResolver.fallback)
        expect(KubeIconResolver.has('toString')).toBe(false)
    })
})
