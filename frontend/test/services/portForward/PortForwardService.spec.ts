import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import type { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import type { TClusterConnection } from '@/application/services/cluster/types/TClusterConnection'
import { PortForwardService } from '@/application/services/portForward/PortForwardService'
import type { IPortForwardSink } from '@/application/services/portForward/types/IPortForwardSink'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import type { KubeForwardAdapter } from '@/infrastructure/channel/KubeForwardAdapter'
import type { HostShellAdapter } from '@/infrastructure/process/HostShellAdapter'
import type { IClusterStream } from '@/infrastructure/kube/types/IClusterStream'
import { MemoryForwardAdapter } from '../../support/MemoryForwardAdapter'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'

const forwards = new MemoryForwardAdapter()
const restTransport = new MemoryKubeTransport()

const registered: { clusterId: string, stream: IClusterStream }[] = []
const connections = new Map<string, TClusterConnection>()
const opened: string[] = []

const connection = (clusterId: string, overrides: Partial<TClusterConnection> = {}): TClusterConnection => ({
    clusterId,
    contextName: clusterId,
    server: `https://${clusterId}.example`,
    sessionId: `session-${clusterId}`,
    version: 'v1.30.1',
    canOpenChannel: true,
    channelBlockReason: '',
    connectedAt: 0,
    ...overrides,
})

const connectionService = {
    connection: (clusterId: string) => connections.get(clusterId) ?? null,
    isConnected: (clusterId: string) => connections.has(clusterId),
    assertChannelAllowed: (clusterId: string) => {
        const found = connections.get(clusterId)
        if (found && !found.canOpenChannel) {
            throw new ApiError(found.channelBlockReason, 'too old')
        }
    },
    context: () => EntityRepo.create().use(KubeEntityContext, restTransport as never).getContext(KubeEntityContext),
    registerStream: (clusterId: string, stream: IClusterStream) => {
        registered.push({ clusterId, stream })
        return () => {
            const at = registered.findIndex(open => open.stream === stream)
            if (at !== -1) {
                registered.splice(at, 1)
            }
        }
    },
} as unknown as ClusterConnectionService

const host = {
    openUri: async (uri: string) => {
        opened.push(uri)
    },
} as unknown as HostShellAdapter

const changed: TPortForward[] = []
const closed: string[] = []

const sink: IPortForwardSink = {
    onForwardChanged: forward => changed.push({ ...forward }),
    onForwardClosed: forwardId => closed.push(forwardId),
}

const service = new PortForwardService(connectionService, forwards as unknown as KubeForwardAdapter, host)

const servicePayload = (targetPort: unknown, selector: Record<string, string> = { app: 'api' }): unknown => ({
    apiVersion: 'v1',
    kind: 'Service',
    metadata: { uid: 'svc-1', name: 'api', namespace: 'payments' },
    spec: { selector, ports: [{ name: 'http', port: 8080, targetPort }] },
})

const podList = (ports: unknown[] = [{ name: 'http', containerPort: 9090 }]): unknown => ({
    apiVersion: 'v1',
    kind: 'PodList',
    metadata: { resourceVersion: '1' },
    items: [{
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { uid: 'pod-1', name: 'api-7d5', namespace: 'payments' },
        spec: { containers: [{ name: 'app', ports }] },
        status: { phase: 'Running' },
    }],
})

describe('PortForwardService', () => {
    beforeEach(async () => {
        await service.closeAll()
        forwards.reset()
        restTransport.reset()
        registered.length = 0
        changed.length = 0
        closed.length = 0
        opened.length = 0
        connections.clear()
        connections.set('prod', connection('prod'))
    })

    describe('a pod', () => {
        it('opens the portforward subresource of that pod', async () => {
            await service.start({
                clusterId: 'prod',
                namespace: 'payments',
                resource: 'pods',
                name: 'api-0',
                remotePort: 8080,
                localPort: 0,
            }, sink)

            const spec = forwards.last.spec

            expect(decodeURIComponent(spec.path)).toBe('/api/v1/namespaces/payments/pods/api-0/portforward?ports=8080')
            expect(spec.sessionId).toBe('session-prod')
            expect(spec.remotePort).toBe(8080)
        })

        // LocalPort 0 makes Go pick a free port and report it back.
        it('takes the port the host handed out', async () => {
            forwards.assignedPort = 41234

            const started = await service.start({
                clusterId: 'prod',
                namespace: 'payments',
                resource: 'pods',
                name: 'api-0',
                remotePort: 8080,
                localPort: 0,
            }, sink)

            expect(started.localPort).toBe(41234)
            expect(service.urlOf(started)).toBe('http://127.0.0.1:41234')
        })

        it('keeps a local port the user asked for', async () => {
            const started = await service.start({
                clusterId: 'prod',
                namespace: 'payments',
                resource: 'pods',
                name: 'api-0',
                remotePort: 8080,
                localPort: 18080,
            }, sink)

            expect(started.localPort).toBe(18080)
        })

        it('lists what it is forwarding, per cluster', async () => {
            connections.set('stage', connection('stage'))

            await service.start({
                clusterId: 'prod', namespace: 'payments', resource: 'pods', name: 'api-0', remotePort: 8080, localPort: 0,
            }, sink)
            await service.start({
                clusterId: 'stage', namespace: 'web', resource: 'pods', name: 'nginx-0', remotePort: 80, localPort: 0,
            }, sink)

            expect(service.list()).toHaveLength(2)
            expect(service.list('prod').map(forward => forward.name)).toEqual(['api-0'])
            expect(service.list('stage').map(forward => forward.name)).toEqual(['nginx-0'])
        })
    })

    describe('a service', () => {
        it('forwards to a running pod behind it, on the numbered target port', async () => {
            restTransport.answerWith(servicePayload(9090))
            restTransport.answerWith(podList())

            const started = await service.start({
                clusterId: 'prod',
                namespace: 'payments',
                resource: 'services',
                name: 'api',
                remotePort: 8080,
                localPort: 0,
            }, sink)

            expect(started.podName).toBe('api-7d5')
            expect(started.targetPort).toBe(9090)
            expect(decodeURIComponent(forwards.last.spec.path))
                .toBe('/api/v1/namespaces/payments/pods/api-7d5/portforward?ports=9090')
        })

        it('resolves a named target port against the pod that serves it', async () => {
            restTransport.answerWith(servicePayload('http'))
            restTransport.answerWith(podList([{ name: 'http', containerPort: 9191 }]))

            const started = await service.start({
                clusterId: 'prod',
                namespace: 'payments',
                resource: 'services',
                name: 'api',
                remotePort: 8080,
                localPort: 0,
            }, sink)

            expect(started.targetPort).toBe(9191)
        })

        it('asks only for running pods that the selector matches', async () => {
            restTransport.answerWith(servicePayload(9090, { app: 'api', tier: 'backend' }))
            restTransport.answerWith(podList())

            await service.start({
                clusterId: 'prod', namespace: 'payments', resource: 'services', name: 'api', remotePort: 8080, localPort: 0,
            }, sink)

            expect(restTransport.path).toContain('labelSelector=app=api,tier=backend')
            expect(restTransport.path).toContain('fieldSelector=status.phase=Running')
        })

        it('refuses when nothing is running behind the service', async () => {
            restTransport.answerWith(servicePayload(9090))
            restTransport.answerWith({ apiVersion: 'v1', kind: 'PodList', metadata: {}, items: [] })

            await expect(service.start({
                clusterId: 'prod', namespace: 'payments', resource: 'services', name: 'api', remotePort: 8080, localPort: 0,
            }, sink)).rejects.toThrow(PortForwardService.noBackend)

            expect(forwards.forwards).toHaveLength(0)
        })
    })

    describe('stopping', () => {
        it('frees the port and forgets the stream registration', async () => {
            const started = await service.start({
                clusterId: 'prod', namespace: 'payments', resource: 'pods', name: 'api-0', remotePort: 8080, localPort: 0,
            }, sink)

            await service.stop(started.forwardId)

            expect(forwards.last.stopped).toBe(true)
            expect(service.list()).toHaveLength(0)
            expect(registered).toHaveLength(0)
        })

        it('answers null for a forward it does not hold', async () => {
            await expect(service.stop('nothing')).resolves.toBeNull()
        })

        it('stops only the forwards of the cluster that went away', async () => {
            connections.set('stage', connection('stage'))

            await service.start({
                clusterId: 'prod', namespace: 'payments', resource: 'pods', name: 'api-0', remotePort: 8080, localPort: 0,
            }, sink)
            await service.start({
                clusterId: 'stage', namespace: 'web', resource: 'pods', name: 'nginx-0', remotePort: 80, localPort: 0,
            }, sink)

            await service.closeCluster('prod')

            expect(service.list('prod')).toHaveLength(0)
            expect(service.list('stage')).toHaveLength(1)
            expect(forwards.forwards[0].stopped).toBe(true)
            expect(forwards.forwards[1].stopped).toBe(false)
        })

        it('is stopped by the stream registry when the cluster disconnects', async () => {
            await service.start({
                clusterId: 'prod', namespace: 'payments', resource: 'pods', name: 'api-0', remotePort: 8080, localPort: 0,
            }, sink)

            await registered[0].stream.stop()

            expect(forwards.last.stopped).toBe(true)
        })
    })

    describe('a forward that dies on its own', () => {
        it('stays listed as failed with the reason', async () => {
            const started = await service.start({
                clusterId: 'prod', namespace: 'payments', resource: 'pods', name: 'api-0', remotePort: 8080, localPort: 0,
            }, sink)

            forwards.last.fail('connection reset by peer')

            expect(changed).toHaveLength(1)
            expect(changed[0].forwardId).toBe(started.forwardId)
            expect(changed[0].state).toBe('failed')
            expect(changed[0].failure).toBe('connection reset by peer')
        })

        it('drops out of the list when the listener closes cleanly', async () => {
            const started = await service.start({
                clusterId: 'prod', namespace: 'payments', resource: 'pods', name: 'api-0', remotePort: 8080, localPort: 0,
            }, sink)

            forwards.last.end('closed')

            expect(closed).toEqual([started.forwardId])
            expect(service.list()).toHaveLength(0)
        })

        it('keeps a failed forward on screen when the listener then closes', async () => {
            await service.start({
                clusterId: 'prod', namespace: 'payments', resource: 'pods', name: 'api-0', remotePort: 8080, localPort: 0,
            }, sink)

            forwards.last.fail('address already in use')
            forwards.last.end('error')

            expect(closed).toHaveLength(0)
            expect(changed[changed.length - 1].state).toBe('failed')
        })
    })

    describe('the cluster it cannot forward from', () => {
        it('refuses on a cluster older than the channel protocol', async () => {
            connections.set('old', connection('old', {
                canOpenChannel: false,
                channelBlockReason: 'This cluster runs v1.28 and kubiq needs v1.30',
            }))

            await expect(service.start({
                clusterId: 'old', namespace: 'payments', resource: 'pods', name: 'api-0', remotePort: 8080, localPort: 0,
            }, sink)).rejects.toThrow('v1.30')
        })

        it('refuses when the cluster is not connected', async () => {
            await expect(service.start({
                clusterId: 'gone', namespace: 'payments', resource: 'pods', name: 'api-0', remotePort: 8080, localPort: 0,
            }, sink)).rejects.toThrow(PortForwardService.notConnected)
        })
    })

    it('opens the forwarded address in the browser', async () => {
        const started = await service.start({
            clusterId: 'prod', namespace: 'payments', resource: 'pods', name: 'api-0', remotePort: 8080, localPort: 18080,
        }, sink)

        await service.open(started.forwardId)

        expect(opened).toEqual(['http://127.0.0.1:18080'])
    })

    it('reads the ports a pod declares', async () => {
        restTransport.answerWith({
            apiVersion: 'v1',
            kind: 'Pod',
            metadata: { uid: 'pod-1', name: 'api-0', namespace: 'payments' },
            spec: { containers: [{ name: 'app', ports: [{ name: 'http', containerPort: 8080 }] }] },
        })

        const ports = await service.ports('prod', 'payments', 'pods', 'api-0')

        expect(ports).toEqual([{ port: 8080, name: 'http' }])
    })

    it('reads the ports a service declares', async () => {
        restTransport.answerWith(servicePayload(9090))

        const ports = await service.ports('prod', 'payments', 'services', 'api')

        expect(ports).toEqual([{ port: 8080, name: 'http' }])
    })

    describe('the names it offers', () => {
        const named = (kind: string, names: string[]): unknown => ({
            apiVersion: 'v1',
            kind: `${kind}List`,
            metadata: { resourceVersion: '1' },
            items: names.map((name, index) => ({
                apiVersion: 'v1',
                kind,
                metadata: { uid: `${name}-${index}`, name, namespace: 'payments' },
                spec: kind === 'Pod' ? { containers: [{ name: 'app' }] } : { ports: [] },
                status: { phase: 'Running' },
            })),
        })

        it('lists the running pods of a namespace, sorted', async () => {
            restTransport.answerWith(named('Pod', ['web-2', 'api-0']))

            await expect(service.names('prod', 'payments', 'pods')).resolves.toEqual(['api-0', 'web-2'])
            expect(restTransport.path).toBe('/api/v1/namespaces/payments/pods?fieldSelector=status.phase=Running')
        })

        it('lists the services of a namespace', async () => {
            restTransport.answerWith(named('Service', ['api', 'web']))

            await expect(service.names('prod', 'payments', 'services')).resolves.toEqual(['api', 'web'])
            expect(restTransport.path).toBe('/api/v1/namespaces/payments/services')
        })

        // The panel opens with no namespace chosen, and a cluster-wide pod list is not what it needs.
        it('asks the cluster for nothing until a namespace is chosen', async () => {
            await expect(service.names('prod', '', 'pods')).resolves.toEqual([])
            expect(restTransport.requests).toHaveLength(0)
        })
    })
})
