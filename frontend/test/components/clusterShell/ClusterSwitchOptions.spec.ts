import { describe, expect, it } from 'vitest'
import { ClusterSwitchOptions } from '@/components/clusterShell/ClusterSwitchOptions'
import type { TClusterRow } from '@/components/cluster/types/TClusterRow'
import type { TClusterStatus } from '@/domain/entities/catalog/types/TClusterStatus'
import { ClusterStatusCatalog } from '@/domain/entities/catalog/ClusterStatusCatalog'

const row = (name: string, status: TClusterStatus, overrides: Partial<TClusterRow> = {}): TClusterRow => ({
    clusterId: name,
    name,
    status,
    statusTitle: ClusterStatusCatalog.title(status),
    clusterName: `${name}-cluster`,
    server: `https://${name}.example.internal:6443`,
    namespace: 'default',
    authType: 'Token',
    version: '',
    source: `${name}.yaml`,
    filePath: `D:/work/${name}.yaml`,
    isPinned: false,
    isCurrent: false,
    isActive: false,
    isConnected: status === 'connected',
    canOpenChannel: status === 'connected',
    detail: '',
    ...overrides,
})

const keys = (rows: TClusterRow[]) => ClusterSwitchOptions.build(rows).map(item => item.key)

describe('ClusterSwitchOptions.build', () => {
    it('offers every context the catalog knows, not only the connected ones', () => {
        const items = keys([row('prod', 'connected'), row('lab', 'available'), row('old', 'unsupported')])

        expect(items).toEqual(['cluster:prod', 'cluster:lab', 'cluster:old', ClusterSwitchOptions.catalogKey])
    })

    it('always offers the catalog, even with no context at all', () => {
        expect(keys([])).toEqual([ClusterSwitchOptions.catalogKey])
    })

    it('puts the clusters already carrying a session first', () => {
        const items = keys([row('lab', 'available'), row('prod', 'connected'), row('staging', 'expired', {
            isConnected: true,
        })])

        expect(items).toEqual([
            'cluster:prod',
            'cluster:staging',
            'cluster:lab',
            ClusterSwitchOptions.catalogKey,
        ])
    })

    it('separates the open clusters from the rest, and never leads with a separator', () => {
        const items = ClusterSwitchOptions.build([row('prod', 'connected'), row('lab', 'available')])

        expect(items.map(item => item.separatorBefore)).toEqual([false, true, true])
    })

    it('leaves the list unbroken when nothing is connected', () => {
        const items = ClusterSwitchOptions.build([row('lab', 'available'), row('old', 'unsupported')])

        expect(items.map(item => item.separatorBefore)).toEqual([false, false, true])
    })

    it('carries the status of each cluster as a tone, so an open one reads apart from an offered one', () => {
        const [connected, available] = ClusterSwitchOptions.build([row('prod', 'connected'), row('lab', 'available')])

        expect(connected.tone).toBe('ok')
        expect(available.tone).toBe('unknown')
    })

    it('hints a cluster with its status and address', () => {
        const [item] = ClusterSwitchOptions.build([row('lab', 'available')])

        expect(item.hint).toBe('Available · https://lab.example.internal:6443')
    })

    it('hints a cluster that cannot be used with the reason instead of the address', () => {
        const [item] = ClusterSwitchOptions.build([
            row('old', 'unsupported', { detail: 'exec plugins arrive later' }),
        ])

        expect(item.hint).toBe('Unsupported · exec plugins arrive later')
    })

    it('reads a cluster back out of the key it was given', () => {
        const [item] = ClusterSwitchOptions.build([row('prod', 'connected')])

        expect(ClusterSwitchOptions.clusterIdOf(item.key)).toBe('prod')
    })

    it('keeps a context named like the catalog entry from opening the catalog', () => {
        const items = ClusterSwitchOptions.build([row(ClusterSwitchOptions.catalogKey, 'available')])

        expect(items.map(item => item.key)).toEqual(['cluster:catalog', ClusterSwitchOptions.catalogKey])
        expect(ClusterSwitchOptions.clusterIdOf(ClusterSwitchOptions.catalogKey)).toBe('')
    })
})
