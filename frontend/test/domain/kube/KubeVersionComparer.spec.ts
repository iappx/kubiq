import { describe, expect, it } from 'vitest'
import { KubeVersionComparer } from '@/domain/models/kube'

describe('KubeVersionComparer', () => {
    it('orders versions the way Kubernetes itself does', () => {
        const sorted = KubeVersionComparer.sort(['v1alpha1', 'v1beta1', 'v2beta1', 'v1', 'v1beta2', 'v2'])

        expect(sorted).toEqual(['v2', 'v1', 'v2beta1', 'v1beta2', 'v1beta1', 'v1alpha1'])
    })

    it('puts any stable version ahead of every pre-release one', () => {
        expect(KubeVersionComparer.compare('v1', 'v2beta1')).toBeLessThan(0)
        expect(KubeVersionComparer.compare('v2beta1', 'v1')).toBeGreaterThan(0)
    })

    it('picks the best of a group', () => {
        expect(KubeVersionComparer.best(['v1beta1', 'v1'])).toBe('v1')
        expect(KubeVersionComparer.best(['v1alpha1', 'v1alpha2'])).toBe('v1alpha2')
        expect(KubeVersionComparer.best([])).toBeUndefined()
    })

    it('sorts a version it cannot parse to the back rather than dropping it', () => {
        const sorted = KubeVersionComparer.sort(['experimental', 'v1'])

        expect(sorted).toEqual(['v1', 'experimental'])
        expect(KubeVersionComparer.best(['experimental'])).toBe('experimental')
    })

    it('leaves the caller array alone', () => {
        const versions = ['v1beta1', 'v1']
        KubeVersionComparer.sort(versions)

        expect(versions).toEqual(['v1beta1', 'v1'])
    })
})
