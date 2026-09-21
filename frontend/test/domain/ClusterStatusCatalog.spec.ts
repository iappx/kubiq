import { describe, expect, it } from 'vitest'
import { ClusterStatusCatalog } from '@/domain/entities/catalog/ClusterStatusCatalog'
import type { TClusterStatus } from '@/domain/entities/catalog/types/TClusterStatus'

const every = Object.keys(ClusterStatusCatalog.values) as TClusterStatus[]

describe('ClusterStatusCatalog', () => {
    it('gives every status a title a human reads', () => {
        every.forEach((status) => {
            expect(ClusterStatusCatalog.title(status).length).toBeGreaterThan(0)
        })

        expect(ClusterStatusCatalog.title('connected')).toBe('Connected')
        expect(ClusterStatusCatalog.title('unreachable')).toBe('Unreachable')
    })

    it('answers with the value itself for something it does not know', () => {
        expect(ClusterStatusCatalog.title('invented' as TClusterStatus)).toBe('invented')
    })

    it('knows which values belong to it', () => {
        expect(ClusterStatusCatalog.has('connected')).toBe(true)
        expect(ClusterStatusCatalog.has('invented')).toBe(false)
        expect(ClusterStatusCatalog.has('toString')).toBe(false)
    })

    it('offers a connect only where connecting makes sense', () => {
        expect(ClusterStatusCatalog.isConnectable('available')).toBe(true)
        expect(ClusterStatusCatalog.isConnectable('unreachable')).toBe(true)
        expect(ClusterStatusCatalog.isConnectable('connected')).toBe(false)
        expect(ClusterStatusCatalog.isConnectable('connecting')).toBe(false)
        expect(ClusterStatusCatalog.isConnectable('unsupported')).toBe(false)
    })

    it('calls out the states the user has to act on', () => {
        expect(ClusterStatusCatalog.isProblematic('unreachable')).toBe(true)
        expect(ClusterStatusCatalog.isProblematic('unsupported')).toBe(true)
        expect(ClusterStatusCatalog.isProblematic('connected')).toBe(false)
        expect(ClusterStatusCatalog.isProblematic('available')).toBe(false)
    })
})
