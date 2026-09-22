import { describe, expect, it } from 'vitest'
import { ClusterRowBuilder } from '@/components/cluster/ClusterRowBuilder'
import { ClusterToneMap } from '@/components/cluster/ClusterToneMap'
import type { TClusterConnection } from '@/application/services/cluster/types/TClusterConnection'
import type { TClusterContextInfo } from '@/application/services/cluster/types/TClusterContextInfo'
import type { TClusterRowInput } from '@/components/cluster/types/TClusterRowInput'
import { ClusterStatusCatalog } from '@/domain/entities/catalog/ClusterStatusCatalog'

const context = (name: string, overrides: Partial<TClusterContextInfo> = {}): TClusterContextInfo => ({
    name,
    filePath: `D:/work/${name}.yaml`,
    clusterName: `${name}-cluster`,
    server: `https://${name}.example.internal:6443`,
    namespace: 'default',
    authType: 'token',
    isCurrent: false,
    isSupported: true,
    unsupportedReason: '',
    ...overrides,
})

const connection = (clusterId: string, overrides: Partial<TClusterConnection> = {}): TClusterConnection => ({
    clusterId,
    contextName: clusterId,
    server: `https://${clusterId}.example.internal:6443`,
    sessionId: `session-${clusterId}`,
    version: 'v1.31.2',
    canOpenChannel: true,
    channelBlockReason: '',
    connectedAt: 1,
    ...overrides,
})

const input = (overrides: Partial<TClusterRowInput> = {}): TClusterRowInput => ({
    contexts: [],
    connections: [],
    pinned: [],
    sourceOrigins: {},
    connectingIds: [],
    failures: {},
    activeClusterId: '',
    ...overrides,
})

describe('ClusterRowBuilder', () => {
    describe('status', () => {
        it('is available for a context nobody has tried', () => {
            const [row] = ClusterRowBuilder.build(input({ contexts: [context('prod')] }))

            expect(row.status).toBe('available')
            expect(row.statusTitle).toBe('Available')
            expect(row.detail).toBe('')
        })

        it('is connected once a session is open, and carries the version', () => {
            const [row] = ClusterRowBuilder.build(input({
                contexts: [context('prod')],
                connections: [connection('prod')],
            }))

            expect(row.status).toBe('connected')
            expect(row.version).toBe('v1.31.2')
        })

        it('is connecting while the attempt is in flight, even with a stale failure', () => {
            const [row] = ClusterRowBuilder.build(input({
                contexts: [context('prod')],
                connectingIds: ['prod'],
                failures: { prod: 'was down a minute ago' },
            }))

            expect(row.status).toBe('connecting')
        })

        it('is unreachable after a failed attempt, and says what happened', () => {
            const [row] = ClusterRowBuilder.build(input({
                contexts: [context('prod')],
                failures: { prod: 'dial tcp: i/o timeout' },
            }))

            expect(row.status).toBe('unreachable')
            expect(row.detail).toBe('dial tcp: i/o timeout')
        })

        it('is unsupported when the kubeconfig auth method is, and repeats the reason', () => {
            const [row] = ClusterRowBuilder.build(input({
                contexts: [context('prod', { isSupported: false, unsupportedReason: 'exec plugins arrive later' })],
            }))

            expect(row.status).toBe('unsupported')
            expect(row.detail).toBe('exec plugins arrive later')
        })

        it('surfaces the channel refusal on a connected but old cluster', () => {
            const [row] = ClusterRowBuilder.build(input({
                contexts: [context('prod')],
                connections: [connection('prod', {
                    version: 'v1.27.9',
                    canOpenChannel: false,
                    channelBlockReason: 'Terminals need 1.30 or newer',
                })],
            }))

            expect(row.status).toBe('connected')
            expect(row.canOpenChannel).toBe(false)
            expect(row.detail).toBe('Terminals need 1.30 or newer')
        })

        it('says the credentials expired on a session the cluster stopped accepting', () => {
            const [row] = ClusterRowBuilder.build(input({
                contexts: [context('prod')],
                connections: [connection('prod')],
                health: { prod: 'expired' },
            }))

            expect(row.status).toBe('expired')
            expect(row.statusTitle).toBe('Credentials expired')
            expect(row.detail).toContain('Reconnect')
            expect(ClusterToneMap.of(row.status)).toBe('error')
        })

        it('says unreachable when an open session stopped answering', () => {
            const [row] = ClusterRowBuilder.build(input({
                contexts: [context('prod')],
                connections: [connection('prod')],
                health: { prod: 'unreachable' },
            }))

            expect(row.status).toBe('unreachable')
            expect(row.detail).toContain('cannot reach the API server')
        })

        it('tells a session that stopped answering from one that was never opened', () => {
            const rows = ClusterRowBuilder.build(input({
                contexts: [context('prod'), context('lab')],
                connections: [connection('prod')],
                health: { prod: 'unreachable' },
                failures: { lab: 'dial tcp: i/o timeout' },
            }))

            expect(rows.map(row => [row.status, row.isConnected])).toEqual([
                ['unreachable', true],
                ['unreachable', false],
            ])
        })

        it('leaves a merely unstable cluster reading as connected', () => {
            const [row] = ClusterRowBuilder.build(input({
                contexts: [context('prod')],
                connections: [connection('prod')],
                health: { prod: 'degraded' },
            }))

            expect(row.status).toBe('connected')
        })

        it('keeps the health of one cluster off another', () => {
            const rows = ClusterRowBuilder.build(input({
                contexts: [context('prod'), context('staging')],
                connections: [connection('prod'), connection('staging')],
                health: { prod: 'expired' },
            }))

            expect(rows.map(row => row.status)).toEqual(['expired', 'connected'])
        })

        it('offers a reconnect for an expired session', () => {
            expect(ClusterStatusCatalog.isConnectable('expired')).toBe(true)
            expect(ClusterStatusCatalog.isProblematic('expired')).toBe(true)
        })
    })

    describe('two clusters', () => {
        it('never lets one cluster\'s connection describe another', () => {
            const rows = ClusterRowBuilder.build(input({
                contexts: [context('prod'), context('lab')],
                connections: [connection('prod', { version: 'v1.31.2' })],
                failures: { lab: 'unreachable' },
                activeClusterId: 'prod',
            }))

            expect(rows.map(row => [row.clusterId, row.status, row.version])).toEqual([
                ['prod', 'connected', 'v1.31.2'],
                ['lab', 'unreachable', ''],
            ])
            expect(rows.map(row => row.isActive)).toEqual([true, false])
        })
    })

    describe('presentation fields', () => {
        it('shortens the kubeconfig path to its file name and keeps the full one', () => {
            const [row] = ClusterRowBuilder.build(input({
                contexts: [context('prod', { filePath: 'C:/Users/tester/.kube/config' })],
            }))

            expect(row.source).toBe('config')
            expect(row.filePath).toBe('C:/Users/tester/.kube/config')
        })

        it('leaves a bare file name alone', () => {
            const [row] = ClusterRowBuilder.build(input({ contexts: [context('prod', { filePath: 'config' })] }))

            expect(row.source).toBe('config')
        })

        it('spells the authentication method out', () => {
            const [row] = ClusterRowBuilder.build(input({
                contexts: [context('prod', { authType: 'clientCertificate' })],
            }))

            expect(row.authType).toBe('Client certificate')
        })

        it('marks what is pinned', () => {
            const rows = ClusterRowBuilder.build(input({
                contexts: [context('prod'), context('lab')],
                pinned: ['lab'],
            }))

            expect(rows.map(row => row.isPinned)).toEqual([false, true])
        })

        it('says where each kubeconfig came from, so a deletable one can be told apart', () => {
            const rows = ClusterRowBuilder.build(input({
                contexts: [context('prod'), context('lab'), context('home')],
                sourceOrigins: {
                    'D:/work/prod.yaml': 'file',
                    'D:/work/lab.yaml': 'paste',
                },
            }))

            expect(rows.map(row => row.sourceOrigin)).toEqual(['file', 'paste', 'discovered'])
        })
    })

    describe('filter', () => {
        const rows = ClusterRowBuilder.build(input({
            contexts: [
                context('prod', { clusterName: 'payments-eu', namespace: 'payments' }),
                context('lab', { clusterName: 'sandbox', namespace: 'default' }),
            ],
        }))

        it('returns everything for an empty or blank query', () => {
            expect(ClusterRowBuilder.filter(rows, '')).toHaveLength(2)
            expect(ClusterRowBuilder.filter(rows, '   ')).toHaveLength(2)
        })

        it('matches the context name regardless of case', () => {
            expect(ClusterRowBuilder.filter(rows, 'PROD').map(row => row.name)).toEqual(['prod'])
        })

        it('matches the cluster name, the server and the namespace', () => {
            expect(ClusterRowBuilder.filter(rows, 'payments-eu').map(row => row.name)).toEqual(['prod'])
            expect(ClusterRowBuilder.filter(rows, 'lab.example').map(row => row.name)).toEqual(['lab'])
            expect(ClusterRowBuilder.filter(rows, 'sandbox').map(row => row.name)).toEqual(['lab'])
        })

        it('answers an empty list rather than everything when nothing matches', () => {
            expect(ClusterRowBuilder.filter(rows, 'nothing-like-this')).toEqual([])
        })
    })

    describe('pinnedOf', () => {
        const rows = ClusterRowBuilder.build(input({
            contexts: [context('prod'), context('lab'), context('staging')],
            pinned: ['staging', 'prod'],
        }))

        it('keeps the order the pins were made in, not the catalog order', () => {
            expect(ClusterRowBuilder.pinnedOf(rows, ['staging', 'prod']).map(row => row.name))
                .toEqual(['staging', 'prod'])
        })

        it('ignores a pin whose context is no longer in any kubeconfig', () => {
            expect(ClusterRowBuilder.pinnedOf(rows, ['ghost', 'prod']).map(row => row.name)).toEqual(['prod'])
        })
    })
})

describe('ClusterToneMap', () => {
    it('gives every status a tone, and health to a connected cluster', () => {
        expect(ClusterToneMap.of('connected')).toBe('ok')
        expect(ClusterToneMap.of('connecting')).toBe('pending')
        expect(ClusterToneMap.of('available')).toBe('unknown')
        expect(ClusterToneMap.of('unreachable')).toBe('error')
        expect(ClusterToneMap.of('unsupported')).toBe('warning')
    })
})
