import { describe, expect, it } from 'vitest'
import { ClusterEntryPhase } from '@/application/services/clusterEntry/models/ClusterEntryPhase'
import type { TClusterEntryStatus } from '@/application/services/clusterEntry/types/TClusterEntryStatus'

const status = (changes: Partial<TClusterEntryStatus> = {}): TClusterEntryStatus => ({
    catalogLoaded: true,
    catalogFailure: '',
    known: true,
    connected: false,
    connecting: false,
    scoped: true,
    failure: '',
    ...changes,
})

describe('ClusterEntryPhase', () => {
    it('is ready once the cluster is connected', () => {
        expect(ClusterEntryPhase.of(status({ connected: true }))).toBe('ready')
    })

    it('stays ready even while an old failure is still remembered', () => {
        expect(ClusterEntryPhase.of(status({ connected: true, failure: 'gone' }))).toBe('ready')
    })

    it('is still connecting while the namespace scope has not been read', () => {
        expect(ClusterEntryPhase.of(status({ connected: true, scoped: false }))).toBe('connecting')
    })

    it('turns ready on a scope that was read and holds no namespace at all', () => {
        expect(ClusterEntryPhase.of(status({ connected: true, scoped: true }))).toBe('ready')
    })

    it('is connecting while the catalog is still being read', () => {
        expect(ClusterEntryPhase.of(status({ catalogLoaded: false, known: false }))).toBe('connecting')
    })

    it('is connecting while the connection is being opened', () => {
        expect(ClusterEntryPhase.of(status({ connecting: true }))).toBe('connecting')
    })

    it('is connecting between the catalog and the connection attempt', () => {
        expect(ClusterEntryPhase.of(status())).toBe('connecting')
    })

    it('says the cluster is unknown once the catalog has been read without it', () => {
        expect(ClusterEntryPhase.of(status({ known: false }))).toBe('unknown')
    })

    it('reports a failure to connect a cluster the catalog does list', () => {
        expect(ClusterEntryPhase.of(status({ failure: 'The cluster rejected the credentials' }))).toBe('failed')
    })

    it('reports a catalog that could not be read at all as a failure, not as an unknown cluster', () => {
        const unreadable = status({
            catalogLoaded: false,
            known: false,
            catalogFailure: 'The kubeconfig file could not be read',
        })

        expect(ClusterEntryPhase.of(unreadable)).toBe('failed')
    })
})
