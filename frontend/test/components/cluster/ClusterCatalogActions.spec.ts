import { describe, expect, it } from 'vitest'
import { ClusterCatalogActions } from '@/components/cluster/ClusterCatalogActions'
import type { TClusterRow } from '@/components/cluster/types/TClusterRow'
import type { TClusterStatus } from '@/domain/entities/catalog/types/TClusterStatus'

const row = (status: TClusterStatus, overrides: Partial<TClusterRow> = {}): TClusterRow => ({
    clusterId: 'prod',
    name: 'prod',
    status,
    statusTitle: status,
    clusterName: 'prod-cluster',
    server: 'https://prod.example.internal:6443',
    namespace: 'default',
    authType: 'Token',
    version: 'v1.31.2',
    source: 'prod.yaml',
    filePath: 'D:/work/prod.yaml',
    sourceOrigin: 'file',
    isPinned: false,
    isCurrent: false,
    isActive: false,
    isConnected: status === 'connected',
    canOpenChannel: true,
    detail: '',
    ...overrides,
})

const keys = (value: TClusterRow | null) => ClusterCatalogActions.of(value).map(item => item.key)

describe('ClusterCatalogActions', () => {
    it('still offers details with no row, so the kebab column exists before a row is picked', () => {
        expect(keys(null)).toEqual([ClusterCatalogActions.detailsKey])
    })

    it('offers opening and disconnecting a connected cluster', () => {
        expect(keys(row('connected'))).toEqual([
            ClusterCatalogActions.enterKey,
            ClusterCatalogActions.detailsKey,
            ClusterCatalogActions.disconnectKey,
            ClusterCatalogActions.pinKey,
            ClusterCatalogActions.deleteKey,
        ])
    })

    it('offers connecting an available cluster and never both verbs at once', () => {
        const items = keys(row('available'))

        expect(items).toContain(ClusterCatalogActions.connectKey)
        expect(items).not.toContain(ClusterCatalogActions.disconnectKey)
        expect(items).not.toContain(ClusterCatalogActions.enterKey)
    })

    it('offers reconnecting a cluster that stopped answering', () => {
        expect(keys(row('unreachable'))).toContain(ClusterCatalogActions.connectKey)
        expect(keys(row('expired'))).toContain(ClusterCatalogActions.connectKey)
    })

    it('leaves out connecting while a connection is already in flight', () => {
        expect(keys(row('connecting'))).toEqual([
            ClusterCatalogActions.detailsKey,
            ClusterCatalogActions.pinKey,
            ClusterCatalogActions.deleteKey,
        ])
    })

    it('never offers to connect a context kubiq cannot speak to', () => {
        expect(keys(row('unsupported'))).toEqual([
            ClusterCatalogActions.detailsKey,
            ClusterCatalogActions.pinKey,
            ClusterCatalogActions.deleteKey,
        ])
    })

    it('offers deleting a cluster whose kubeconfig kubiq was given', () => {
        expect(keys(row('available', { sourceOrigin: 'paste' }))).toContain(ClusterCatalogActions.deleteKey)
    })

    it('never offers to delete a context found in a kubeconfig kubiq only reads', () => {
        expect(keys(row('available', { sourceOrigin: 'discovered' })))
            .not.toContain(ClusterCatalogActions.deleteKey)
    })

    it('marks deleting as the destructive verb', () => {
        const item = ClusterCatalogActions
            .of(row('available'))
            .find(entry => entry.key === ClusterCatalogActions.deleteKey)

        expect(item?.danger).toBe(true)
        expect(item?.label).toBe('Delete')
    })

    it('puts deleting last, away from what the operator clicks every day', () => {
        expect(keys(row('connected')).at(-1)).toBe(ClusterCatalogActions.deleteKey)
    })

    it('names the pin verb after what the row is now', () => {
        const pinLabel = (isPinned: boolean) => ClusterCatalogActions
            .of(row('available', { isPinned }))
            .find(item => item.key === ClusterCatalogActions.pinKey)?.label

        expect(pinLabel(false)).toBe('Pin')
        expect(pinLabel(true)).toBe('Unpin')
    })

    it('separates the connection verb and the pin verb from the rest', () => {
        const items = ClusterCatalogActions.of(row('connected'))

        expect(items.filter(item => item.separatorBefore).map(item => item.key)).toEqual([
            ClusterCatalogActions.disconnectKey,
            ClusterCatalogActions.pinKey,
            ClusterCatalogActions.deleteKey,
        ])
    })
})
