import { describe, expect, it } from 'vitest'
import { ClusterHealthCatalog, KubeAccessHint, KubeFailureCatalog, KubeNetworkFailure, KubeResourceKind } from '@/domain/models/kube'
import type { TKubeFailureKind } from '@/domain/models/kube'

const pods = new KubeResourceKind({
    group: '',
    version: 'v1',
    resource: 'pods',
    kind: 'Pod',
    title: 'Pods',
    namespaced: true,
    section: 'workloads',
    icon: 'Box',
    columns: [],
    verbs: ['list'],
})

const deployments = new KubeResourceKind({
    group: 'apps',
    version: 'v1',
    resource: 'deployments',
    kind: 'Deployment',
    title: 'Deployments',
    namespaced: true,
    section: 'workloads',
    icon: 'Layers',
    columns: [],
    verbs: ['list'],
})

const nodes = new KubeResourceKind({
    group: '',
    version: 'v1',
    resource: 'nodes',
    kind: 'Node',
    title: 'Nodes',
    namespaced: false,
    section: 'cluster',
    icon: 'Server',
    columns: [],
    verbs: ['list'],
})

describe('KubeFailureCatalog', () => {
    it('names every status the cluster answers with', () => {
        const expected: [number, TKubeFailureKind][] = [
            [401, 'unauthorized'],
            [403, 'forbidden'],
            [404, 'missing'],
            [409, 'conflict'],
            [410, 'expired'],
            [422, 'invalid'],
            [429, 'throttled'],
            [503, 'unavailable'],
            [500, 'serverError'],
            [502, 'serverError'],
            [418, 'unknown'],
        ]

        expected.forEach(([status, kind]) => expect(KubeFailureCatalog.kindOf(status)).toBe(kind))
    })

    it('writes a sentence of its own for every kind it names', () => {
        const kinds: TKubeFailureKind[] = [
            'unauthorized', 'forbidden', 'missing', 'conflict', 'invalid', 'expired',
            'throttled', 'unavailable', 'serverError', 'timeout', 'tls', 'unreachable',
            'disconnected', 'unknown',
        ]

        const texts = kinds.map(kind => KubeFailureCatalog.message(kind))

        expect(texts.every(text => text.length > 0)).toBe(true)
        expect(new Set(texts).size).toBe(kinds.length)
    })

    it('tells the user to reconnect only where reconnecting is the answer', () => {
        expect(KubeFailureCatalog.needsReconnect('unauthorized')).toBe(true)
        expect(KubeFailureCatalog.needsReconnect('disconnected')).toBe(true)
        expect(KubeFailureCatalog.needsReconnect('forbidden')).toBe(false)
        expect(KubeFailureCatalog.needsReconnect('missing')).toBe(false)
    })

    it('calls a refusal permanent and an outage transient', () => {
        expect(KubeFailureCatalog.isTransient('throttled')).toBe(true)
        expect(KubeFailureCatalog.isTransient('unavailable')).toBe(true)
        expect(KubeFailureCatalog.isTransient('timeout')).toBe(true)
        expect(KubeFailureCatalog.isTransient('unreachable')).toBe(true)
        expect(KubeFailureCatalog.isTransient('forbidden')).toBe(false)
        expect(KubeFailureCatalog.isTransient('unauthorized')).toBe(false)
    })

    it('says the credentials expired and what to do about it', () => {
        expect(KubeFailureCatalog.describe(401)).toContain('Reconnect')
    })
})

describe('KubeNetworkFailure', () => {
    it('reads a deadline the request outlived as a timeout', () => {
        expect(KubeNetworkFailure.kindOf('Get "https://api:6443/api/v1/pods": context deadline exceeded'))
            .toBe('timeout')
        expect(KubeNetworkFailure.kindOf('Client.Timeout exceeded while awaiting headers')).toBe('timeout')
    })

    it('claims a TLS handshake timeout as a timeout, not a certificate problem', () => {
        expect(KubeNetworkFailure.kindOf('net/http: TLS handshake timeout')).toBe('timeout')
    })

    it('reads a rejected certificate as a TLS failure', () => {
        expect(KubeNetworkFailure.kindOf('tls: failed to verify certificate: x509: certificate signed by unknown authority'))
            .toBe('tls')
        expect(KubeNetworkFailure.kindOf('x509: certificate has expired or is not yet valid')).toBe('tls')
    })

    it('reads a session the Go side no longer holds as a closed connection', () => {
        expect(KubeNetworkFailure.kindOf('unknown session: session-7')).toBe('disconnected')
    })

    it('reads a dial that never landed as an unreachable server', () => {
        expect(KubeNetworkFailure.kindOf('dial tcp 10.0.0.1:6443: connect: connection refused')).toBe('unreachable')
        expect(KubeNetworkFailure.kindOf('dial tcp: lookup api.example: no such host')).toBe('unreachable')
        expect(KubeNetworkFailure.kindOf('dial tcp 10.0.0.1:6443: connect: timed out')).toBe('unreachable')
        expect(KubeNetworkFailure.kindOf('')).toBe('unreachable')
    })

    it('classifies the transport failure through the status the cluster never sent', () => {
        expect(KubeFailureCatalog.kindOf(0, 'x509: unknown authority')).toBe('tls')
        expect(KubeFailureCatalog.describe(0, 'context deadline exceeded'))
            .toBe(KubeFailureCatalog.message('timeout'))
    })
})

describe('KubeAccessHint', () => {
    it('names a Role when the refusal was scoped to a namespace', () => {
        expect(KubeAccessHint.of('list', pods, 'dev'))
            .toBe('A Role granting "list" on "pods" in namespace "dev" would allow this.')
    })

    it('carries the api group the way kubectl spells it', () => {
        expect(KubeAccessHint.of('list', deployments, 'dev')).toContain('"deployments.apps"')
    })

    it('names a ClusterRole for a cluster-scoped kind', () => {
        expect(KubeAccessHint.of('list', nodes)).toBe('A ClusterRole granting "list" on "nodes" would allow this.')
    })

    it('names a ClusterRole when no single namespace is in scope', () => {
        expect(KubeAccessHint.of('list', pods)).toContain('ClusterRole')
    })

    it('says nothing when the kind is unknown', () => {
        expect(KubeAccessHint.of('list', null, 'dev')).toBe('')
    })

    it('builds the same sentence from a bare resource name', () => {
        expect(KubeAccessHint.forResource('list', 'pods')).toBe(KubeAccessHint.of('list', nodes).replace('nodes', 'pods'))
    })
})

describe('ClusterHealthCatalog', () => {
    it('turns a rejected credential into an expired connection', () => {
        expect(ClusterHealthCatalog.ofFailure('unauthorized')).toBe('expired')
        expect(ClusterHealthCatalog.needsReconnect('expired')).toBe(true)
    })

    it('turns an unreachable server and a broken certificate into the same state', () => {
        expect(ClusterHealthCatalog.ofFailure('unreachable')).toBe('unreachable')
        expect(ClusterHealthCatalog.ofFailure('tls')).toBe('unreachable')
        expect(ClusterHealthCatalog.ofFailure('disconnected')).toBe('unreachable')
    })

    it('leaves a cluster that answered healthy, however it answered', () => {
        expect(ClusterHealthCatalog.ofFailure('forbidden')).toBe('healthy')
        expect(ClusterHealthCatalog.ofFailure('missing')).toBe('healthy')
        expect(ClusterHealthCatalog.ofFailure('conflict')).toBe('healthy')
    })

    it('calls a rate limit and an outage unstable rather than broken', () => {
        expect(ClusterHealthCatalog.ofFailure('throttled')).toBe('degraded')
        expect(ClusterHealthCatalog.ofFailure('unavailable')).toBe('degraded')
        expect(ClusterHealthCatalog.ofFailure('timeout')).toBe('degraded')
    })

    it('has copy for every state and a separate one for no network', () => {
        expect(ClusterHealthCatalog.notice('expired').description).toContain('Reconnect')
        expect(ClusterHealthCatalog.offlineNotice().title).toBe('No network')
    })
})
