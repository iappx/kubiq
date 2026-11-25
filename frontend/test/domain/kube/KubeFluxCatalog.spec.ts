import { describe, expect, it } from 'vitest'
import { KubeIconResolver } from '@/components/common/icon/KubeIconResolver'
import { KubeFluxCatalog } from '@/domain/models/kube'

describe('KubeFluxCatalog', () => {
    it('recognizes all Flux toolkit API groups and rejects others', () => {
        expect(KubeFluxCatalog.isFlux('kustomize.toolkit.fluxcd.io')).toBe(true)
        expect(KubeFluxCatalog.isFlux('helm.toolkit.fluxcd.io')).toBe(true)
        expect(KubeFluxCatalog.isFlux('source.toolkit.fluxcd.io')).toBe(true)
        expect(KubeFluxCatalog.isFlux('notification.toolkit.fluxcd.io')).toBe(true)
        expect(KubeFluxCatalog.isFlux('image.toolkit.fluxcd.io')).toBe(true)
        expect(KubeFluxCatalog.isFlux('cert-manager.io')).toBe(false)
        expect(KubeFluxCatalog.isFlux('apps')).toBe(false)
        expect(KubeFluxCatalog.isFlux('')).toBe(false)
    })

    it('returns icon names supported by KubeIconResolver for every Flux resource', () => {
        const samples: [string, string][] = [
            ['kustomize.toolkit.fluxcd.io', 'kustomizations'],
            ['helm.toolkit.fluxcd.io', 'helmreleases'],
            ['source.toolkit.fluxcd.io', 'gitrepositories'],
            ['source.toolkit.fluxcd.io', 'helmrepositories'],
            ['source.toolkit.fluxcd.io', 'ocirepositories'],
            ['source.toolkit.fluxcd.io', 'buckets'],
            ['source.toolkit.fluxcd.io', 'helmcharts'],
            ['notification.toolkit.fluxcd.io', 'alerts'],
            ['image.toolkit.fluxcd.io', 'imagerepositories'],
            ['unknown.group', 'things'],
        ]

        for (const [group, resource] of samples) {
            const icon = KubeFluxCatalog.iconOf(group, resource)
            expect(KubeIconResolver.has(icon)).toBe(true)
        }
    })

    it('orders primary Flux resources in operator order', () => {
        const ordered = [
            KubeFluxCatalog.orderOf('kustomize.toolkit.fluxcd.io', 'kustomizations'),
            KubeFluxCatalog.orderOf('helm.toolkit.fluxcd.io', 'helmreleases'),
            KubeFluxCatalog.orderOf('source.toolkit.fluxcd.io', 'gitrepositories'),
            KubeFluxCatalog.orderOf('source.toolkit.fluxcd.io', 'helmrepositories'),
            KubeFluxCatalog.orderOf('source.toolkit.fluxcd.io', 'ocirepositories'),
            KubeFluxCatalog.orderOf('source.toolkit.fluxcd.io', 'buckets'),
            KubeFluxCatalog.orderOf('source.toolkit.fluxcd.io', 'helmcharts'),
            KubeFluxCatalog.orderOf('image.toolkit.fluxcd.io', 'imagepolicies'),
            KubeFluxCatalog.orderOf('notification.toolkit.fluxcd.io', 'alerts'),
        ]

        expect(ordered).toEqual([...ordered].sort((a, b) => a - b))
        expect(new Set(ordered).size).toBe(ordered.length)
    })
})
