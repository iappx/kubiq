import { describe, expect, it } from 'vitest'
import { ClusterSwitchGroups } from '@/components/clusterShell/ClusterSwitchGroups'
import type { TClusterRow } from '@/components/cluster/types/TClusterRow'
import type { TClusterStatus } from '@/domain/entities/catalog/types/TClusterStatus'
import { ClusterMonogram } from '@/domain/entities/catalog/ClusterMonogram'
import { ClusterStatusCatalog } from '@/domain/entities/catalog/ClusterStatusCatalog'

const row = (name: string, status: TClusterStatus, overrides: Partial<TClusterRow> = {}): TClusterRow => ({
    clusterId: name,
    name,
    displayName: name,
    icon: ClusterMonogram.iconFor(name),
    status,
    statusTitle: ClusterStatusCatalog.title(status),
    clusterName: `${name}-cluster`,
    server: `https://${name}.example.internal:6443`,
    namespace: 'default',
    authType: 'Token',
    version: '',
    source: `${name}.yaml`,
    filePath: `D:/work/${name}.yaml`,
    sourceOrigin: 'file',
    isPinned: false,
    isCurrent: false,
    isActive: false,
    isConnected: status === 'connected',
    canOpenChannel: status === 'connected',
    detail: '',
    ...overrides,
})

describe('ClusterSwitchGroups.build', () => {
    it('returns no groups when there are no clusters', () => {
        expect(ClusterSwitchGroups.build([])).toEqual([])
    })

    it('splits connected and disconnected clusters while preserving ClusterChoices ordering', () => {
        const groups = ClusterSwitchGroups.build([
            row('lab', 'available'),
            row('prod', 'connected'),
            row('staging', 'expired', { isConnected: true }),
            row('old', 'unsupported'),
        ])

        expect(groups.map(group => ({
            key: group.key,
            title: group.title,
            ids: group.rows.map(item => item.clusterId),
        }))).toEqual([
            { key: 'connected', title: 'Connected', ids: ['prod', 'staging'] },
            { key: 'disconnected', title: 'Disconnected', ids: ['lab', 'old'] },
        ])
    })

    it('omits the disconnected group when every cluster is connected', () => {
        const groups = ClusterSwitchGroups.build([
            row('prod', 'connected'),
            row('staging', 'unreachable', { isConnected: true }),
        ])

        expect(groups.map(group => group.key)).toEqual(['connected'])
        expect(groups[0].rows.map(item => item.clusterId)).toEqual(['prod', 'staging'])
    })

    it('omits the connected group when no cluster is connected', () => {
        const groups = ClusterSwitchGroups.build([
            row('lab', 'available'),
            row('old', 'unsupported'),
        ])

        expect(groups.map(group => group.key)).toEqual(['disconnected'])
        expect(groups[0].rows.map(item => item.clusterId)).toEqual(['lab', 'old'])
    })
})

describe('ClusterSwitchGroups.isUnhealthy', () => {
    it('returns false for a healthy connected cluster', () => {
        expect(ClusterSwitchGroups.isUnhealthy(row('prod', 'connected'))).toBe(false)
    })

    it('returns true for connected clusters whose status is not connected', () => {
        expect(ClusterSwitchGroups.isUnhealthy(row('prod', 'unreachable', { isConnected: true }))).toBe(true)
        expect(ClusterSwitchGroups.isUnhealthy(row('prod', 'expired', { isConnected: true }))).toBe(true)
        expect(ClusterSwitchGroups.isUnhealthy(row('prod', 'connecting', { isConnected: true }))).toBe(true)
    })

    it('returns false for disconnected clusters regardless of status', () => {
        expect(ClusterSwitchGroups.isUnhealthy(row('lab', 'available', { isConnected: false }))).toBe(false)
        expect(ClusterSwitchGroups.isUnhealthy(row('lab', 'unreachable', { isConnected: false }))).toBe(false)
        expect(ClusterSwitchGroups.isUnhealthy(row('lab', 'expired', { isConnected: false }))).toBe(false)
        expect(ClusterSwitchGroups.isUnhealthy(row('lab', 'unsupported', { isConnected: false }))).toBe(false)
    })
})
