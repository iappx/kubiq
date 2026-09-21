import { describe, expect, it } from 'vitest'
import { KubeResourceKind, KubeResourceRegistry } from '@/domain/models/kube'

describe('KubeResourceKind slugs', () => {
    it('spells a core kind as its plural alone', () => {
        expect(KubeResourceRegistry.find('', 'pods')?.slug).toBe('pods')
    })

    it('spells a grouped kind the way kubectl does', () => {
        expect(KubeResourceRegistry.find('apps', 'deployments')?.slug).toBe('deployments.apps')
    })

    it('parses a core slug back into an empty group', () => {
        expect(KubeResourceKind.parseSlug('pods')).toMatchObject({ group: '', resource: 'pods' })
    })

    it('parses a grouped slug back into group and resource', () => {
        expect(KubeResourceKind.parseSlug('ingresses.networking.k8s.io')).toMatchObject({
            group: 'networking.k8s.io',
            resource: 'ingresses',
        })
    })

    it('round-trips every kind the registry knows', () => {
        KubeResourceRegistry.all().forEach((kind) => {
            expect(KubeResourceRegistry.findBySlug(kind.slug)?.registryKey).toBe(kind.registryKey)
        })
    })

    it('gives every kind a slug of its own', () => {
        const slugs = KubeResourceRegistry.all().map(kind => kind.slug)

        expect(new Set(slugs).size).toBe(slugs.length)
    })

    it('does not resolve a slug the registry has no entry for', () => {
        expect(KubeResourceRegistry.findBySlug('widgets.example.com')).toBeUndefined()
    })
})
