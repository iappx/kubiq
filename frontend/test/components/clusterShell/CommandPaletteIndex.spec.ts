import { describe, expect, it } from 'vitest'
import { CommandPaletteIndex } from '@/components/clusterShell/CommandPaletteIndex'
import { KubeResourceRegistry } from '@/domain/models/kube'
import type { TClusterConnection } from '@/application/services/cluster/types/TClusterConnection'
import type { TCommandItem } from '@/components/clusterShell/types/TCommandItem'

const connection = (clusterId: string): TClusterConnection => ({
    clusterId,
    contextName: clusterId,
    server: `https://${clusterId}.example.com`,
    sessionId: `session-${clusterId}`,
    version: 'v1.32.0',
    canOpenChannel: true,
    channelBlockReason: '',
    connectedAt: 0,
})

const input = {
    clusterId: 'prod',
    connections: [connection('prod'), connection('lab')],
    kinds: [
        KubeResourceRegistry.find('', 'pods')!,
        KubeResourceRegistry.find('apps', 'deployments')!,
    ],
    namespaces: ['default', 'payments'],
}

const keys = (items: TCommandItem[]) => items.map(item => item.key)

describe('CommandPaletteIndex.build', () => {
    it('offers the kinds of the cluster in view', () => {
        expect(keys(CommandPaletteIndex.build(input))).toContain('kind:/v1/pods')
    })

    it('points a kind at its own screen', () => {
        const pods = CommandPaletteIndex.build(input).find(item => item.key === 'kind:/v1/pods')

        expect(pods?.path).toBe('/cluster/prod/workloads/pods')
    })

    it('offers the other connected clusters, never the one already open', () => {
        const clusters = keys(CommandPaletteIndex.build(input))

        expect(clusters).toContain('cluster:lab')
        expect(clusters).not.toContain('cluster:prod')
    })

    it('always offers the catalog', () => {
        expect(keys(CommandPaletteIndex.build(input))).toContain('cluster:catalog')
    })

    it('hints a kind with its API group, so two same-named kinds never read alike', () => {
        const hints = CommandPaletteIndex.build({
            ...input,
            kinds: [
                KubeResourceRegistry.find('', 'pods')!,
                KubeResourceRegistry.find('apps', 'deployments')!,
            ],
        })
            .filter(item => item.key.startsWith('kind:'))
            .map(item => item.hint)

        expect(hints).toEqual(['v1', 'apps'])
    })

    it('finds a kind by typing its API group', () => {
        expect(keys(CommandPaletteIndex.filter(CommandPaletteIndex.build(input), 'apps', [])))
            .toEqual(['kind:apps/v1/deployments'])
    })

    it('offers namespaces as a scope rather than a destination', () => {
        const namespace = CommandPaletteIndex.build(input).find(item => item.key === 'namespace:payments')

        expect(namespace).toMatchObject({ namespace: 'payments' })
        expect(namespace?.path).toBeUndefined()
    })

    it('offers only clusters when none is open, because nothing else is in scope', () => {
        const items = CommandPaletteIndex.build({ ...input, clusterId: '' })

        expect(keys(items)).toEqual(['cluster:prod', 'cluster:lab', 'cluster:catalog'])
    })
})

describe('CommandPaletteIndex.filter', () => {
    const items = CommandPaletteIndex.build(input)

    it('matches on the label', () => {
        expect(keys(CommandPaletteIndex.filter(items, 'deploy', []))).toEqual(['kind:apps/v1/deployments'])
    })

    it('ignores case', () => {
        expect(keys(CommandPaletteIndex.filter(items, 'PODS', []))).toContain('kind:/v1/pods')
    })

    it('matches on the group, so typing a section name finds its kinds', () => {
        expect(keys(CommandPaletteIndex.filter(items, 'namespaces', []))).toContain('namespace:default')
    })

    it('shows at most eight entries', () => {
        const everything = CommandPaletteIndex.build({ ...input, kinds: KubeResourceRegistry.all() })

        expect(CommandPaletteIndex.filter(everything, '', [])).toHaveLength(CommandPaletteIndex.visibleCap)
    })

    it('puts recent entries first', () => {
        expect(keys(CommandPaletteIndex.filter(items, '', ['cluster:catalog']))[0]).toBe('cluster:catalog')
    })

    it('drops a recent entry the query no longer matches', () => {
        expect(keys(CommandPaletteIndex.filter(items, 'pods', ['cluster:catalog']))).toEqual(['kind:/v1/pods'])
    })

    it('answers with nothing when nothing matches', () => {
        expect(CommandPaletteIndex.filter(items, 'nothing here', [])).toEqual([])
    })
})

describe('CommandPaletteIndex bookkeeping', () => {
    it('moves a chosen entry to the front without repeating it', () => {
        const remembered = CommandPaletteIndex.remember(['a', 'b'], 'b')

        expect(remembered).toEqual(['b', 'a'])
    })

    it('keeps the recent list short', () => {
        const many = Array.from({ length: 12 }, (_, index) => `key-${index}`)

        expect(CommandPaletteIndex.remember(many, 'fresh')).toHaveLength(CommandPaletteIndex.visibleCap)
    })

    it('wraps the cursor at both ends', () => {
        expect(CommandPaletteIndex.nextCursor(2, 1, 3)).toBe(0)
        expect(CommandPaletteIndex.nextCursor(0, -1, 3)).toBe(2)
    })

    it('stays at zero when there is nothing to move through', () => {
        expect(CommandPaletteIndex.nextCursor(0, 1, 0)).toBe(0)
    })
})
