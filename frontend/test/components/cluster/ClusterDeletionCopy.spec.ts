import { describe, expect, it } from 'vitest'
import { ClusterDeletionCopy } from '@/components/cluster/ClusterDeletionCopy'
import type { TKubeconfigDeletion } from '@/store/modules/clusterCatalog/types/TKubeconfigDeletion'

const target = (overrides: Partial<TKubeconfigDeletion> = {}): TKubeconfigDeletion => ({
    filePath: 'D:/work/prod.yaml',
    origin: 'file',
    clusterNames: ['prod'],
    ...overrides,
})

describe('ClusterDeletionCopy', () => {
    describe('title', () => {
        it('names the one cluster that goes', () => {
            expect(ClusterDeletionCopy.titleOf(target())).toBe('Delete cluster prod')
        })

        it('counts them when a kubeconfig holds several', () => {
            expect(ClusterDeletionCopy.titleOf(target({ clusterNames: ['prod', 'lab'] })))
                .toBe('Delete 2 clusters')
        })

        it('speaks of the file when it yields no cluster at all', () => {
            expect(ClusterDeletionCopy.titleOf(target({ clusterNames: [] }))).toBe('Remove kubeconfig')
        })

        it('says something with nothing picked, so the dialog is never blank mid-close', () => {
            expect(ClusterDeletionCopy.titleOf(null)).toBe('Remove kubeconfig')
        })
    })

    describe('description', () => {
        it('warns that a pasted config is erased and cannot be recovered', () => {
            const text = ClusterDeletionCopy.descriptionOf(target({ origin: 'paste' }))

            expect(text).toContain('prod leaves the catalog')
            expect(text).toContain('deleted from this machine')
            expect(text).toContain('cannot be undone')
        })

        it('promises a file the operator named is left where it is', () => {
            const text = ClusterDeletionCopy.descriptionOf(target())

            expect(text).toContain('D:/work/prod.yaml stays on disk untouched')
            expect(text).not.toContain('cannot be undone')
        })

        it('names every cluster a shared kubeconfig takes with it', () => {
            const text = ClusterDeletionCopy.descriptionOf(target({ clusterNames: ['prod', 'lab'] }))

            expect(text).toContain('prod, lab leave the catalog')
        })

        it('says plainly when the file no longer holds a cluster', () => {
            const text = ClusterDeletionCopy.descriptionOf(target({ clusterNames: [] }))

            expect(text).toContain('No cluster in the catalog comes from this kubeconfig')
        })
    })
})
