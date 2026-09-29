import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import type { ClipboardService } from '@/application/services/clipboard/ClipboardService'
import type { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import type { TClusterConnection } from '@/application/services/cluster/types/TClusterConnection'
import type { IdService } from '@/application/services/id/IdService'
import { PortForwardService } from '@/application/services/portForward/PortForwardService'
import { PortForwardRecord } from '@/application/services/portForward/models/PortForwardRecord'
import type { IPortForwardSink } from '@/application/services/portForward/types/IPortForwardSink'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import type { TPortForwardRuntime } from '@/application/services/portForward/types/TPortForwardRuntime'
import { ApiError } from '@/domain/errors/ApiError'
import { EntityRepoProvider } from '@/infrastructure/entityRepo/EntityRepoProvider'
import { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import type { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import type { KubeForwardAdapter } from '@/infrastructure/channel/KubeForwardAdapter'
import type { HostShellAdapter } from '@/infrastructure/process/HostShellAdapter'
import type { IClusterStream } from '@/infrastructure/kube/types/IClusterStream'
import { MemoryFileTransport } from '../../support/MemoryFileTransport'
import { MemoryForwardAdapter } from '../../support/MemoryForwardAdapter'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'

const FORWARDS_FILE = 'userdata:forwards/port-forwards.json'

const forwards = new MemoryForwardAdapter()
const restTransport = new MemoryKubeTransport()
const fileTransport = new MemoryFileTransport()

const registered: { clusterId: string, stream: IClusterStream }[] = []
const connections = new Map<string, TClusterConnection>()
const opened: string[] = []
let nextId = 0

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

const ids = {
    next: () => {
        nextId += 1
        return `pf-${nextId}`
    },
} as unknown as IdService

const changes: { id: string, runtime: TPortForwardRuntime }[] = []

const sink: IPortForwardSink = {
    onForwardChanged: (id, runtime) => changes.push({ id, runtime: { ...runtime } }),
}

const copied: string[] = []

const clipboard = {
    write: async (text: string) => {
        copied.push(text)
    },
} as unknown as ClipboardService

const service = new PortForwardService(
    new EntityRepoProvider(fileTransport as unknown as FileSystemTransport),
    ids,
    connectionService,
    forwards as unknown as KubeForwardAdapter,
    host,
    clipboard,
)

const forward = (overrides: Partial<TPortForward> = {}): TPortForward => ({
    id: 'pf-1',
    clusterId: 'prod',
    namespace: 'payments',
    resource: 'pods',
    name: 'api-0',
    remotePort: 8080,
    localPort: 0,
    lastLocalPort: 0,
    restoreMode: 'onConnect',
    isStoppedByUser: false,
    createdAt: 1,
    label: 'pod/api-0:8080',
    ...PortForwardRecord.idle('stopped'),
    ...overrides,
})

const svcForward = (overrides: Partial<TPortForward> = {}): TPortForward => forward({
    resource: 'services',
    name: 'api',
    label: 'svc/api:8080',
    ...overrides,
})

const pod = (
    name: string,
    ports: unknown[] = [{ name: 'http', containerPort: 9090 }],
    extra: { phase?: string, deleting?: boolean } = {},
): Record<string, unknown> => ({
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: {
        uid: `uid-${name}`,
        name,
        namespace: 'payments',
        ...(extra.deleting ? { deletionTimestamp: '2026-09-24T10:00:00Z' } : {}),
    },
    spec: { containers: [{ name: 'app', ports }] },
    status: { phase: extra.phase ?? 'Running' },
})

const podList = (...items: unknown[]): unknown => ({
    apiVersion: 'v1',
    kind: 'PodList',
    metadata: { resourceVersion: '1' },
    items,
})

const servicePayload = (targetPort: unknown, selector: Record<string, string> = { app: 'api' }): unknown => ({
    apiVersion: 'v1',
    kind: 'Service',
    metadata: { uid: 'svc-1', name: 'api', namespace: 'payments' },
    spec: { selector, ports: [{ name: 'http', port: 8080, targetPort }] },
})

const missing = (): ApiError => new ApiError('Not found', 'pods "api-7d5" not found', 404)

const settle = async (): Promise<void> => {
    for (let pass = 0; pass < 5; pass++) {
        await new Promise(resolve => setTimeout(resolve, 0))
    }
}

describe('PortForwardService', () => {
    beforeEach(async () => {
        await service.stopAll()
        forwards.reset()
        restTransport.reset()
        fileTransport.files.clear()
        registered.length = 0
        changes.length = 0
        opened.length = 0
        copied.length = 0
        nextId = 0
        connections.clear()
        connections.set('prod', connection('prod'))
    })

    afterEach(async () => {
        await service.stopAll()
    })

    describe('the saved forwards', () => {
        it('keeps them in the user profile with the defaults filled in', async () => {
            const created = await service.create({
                clusterId: 'prod',
                namespace: 'payments',
                resource: 'services',
                name: 'api',
                remotePort: '8080',
                localPort: 0,
            }, 1000)

            expect(created.id).toBe('pf-1')
            expect(created.remotePort).toBe(8080)
            expect(created.restoreMode).toBe('onConnect')
            expect(created.label).toBe('svc/api:8080')
            expect(fileTransport.read(FORWARDS_FILE)).toEqual([{
                id: 'pf-1',
                clusterId: 'prod',
                namespace: 'payments',
                resource: 'services',
                name: 'api',
                remotePort: 8080,
                localPort: 0,
                lastLocalPort: 0,
                restoreMode: 'onConnect',
                isStoppedByUser: false,
                createdAt: 1000,
            }])
        })

        it('keeps a named remote port as a name', async () => {
            const created = await service.create({
                clusterId: 'prod', namespace: 'payments', resource: 'pods', name: 'api-0', remotePort: 'http', localPort: 0,
            }, 1)

            expect(created.remotePort).toBe('http')
        })

        it('lists every cluster, resting as their restore mode says', async () => {
            await service.create({
                clusterId: 'prod', namespace: 'payments', resource: 'pods', name: 'api-0', remotePort: 8080, localPort: 0,
            }, 1)
            await service.create({
                clusterId: 'stage', namespace: 'web', resource: 'pods', name: 'nginx-0', remotePort: 80, localPort: 0,
                restoreMode: 'manual',
            }, 2)

            const listed = await service.list()

            expect(listed.map(row => [row.clusterId, row.status])).toEqual([['prod', 'waiting'], ['stage', 'stopped']])
        })

        it('changes the ports and the mode of a saved forward', async () => {
            await service.create({
                clusterId: 'prod', namespace: 'payments', resource: 'pods', name: 'api-0', remotePort: 8080, localPort: 0,
            }, 1)

            const updated = await service.update('pf-1', { remotePort: 9090, localPort: 18080, restoreMode: 'manual' })

            expect(updated.remotePort).toBe(9090)
            expect(updated.localPort).toBe(18080)
            expect(updated.restoreMode).toBe('manual')
            expect(fileTransport.read(FORWARDS_FILE)[0]).toMatchObject({ remotePort: 9090, localPort: 18080, restoreMode: 'manual' })
        })

        it('refuses to change a forward that is not saved', async () => {
            await expect(service.update('nothing', { localPort: 1 })).rejects.toThrow(PortForwardService.unknownForward)
        })

        it('remembers the port a forward got', async () => {
            await service.create({
                clusterId: 'prod', namespace: 'payments', resource: 'pods', name: 'api-0', remotePort: 8080, localPort: 0,
            }, 1)

            await service.rememberPort('pf-1', 41234)

            expect(fileTransport.read(FORWARDS_FILE)[0].lastLocalPort).toBe(41234)
        })

        it('remembers that the user stopped a forward, and lists it stopped whatever its mode', async () => {
            await service.create({
                clusterId: 'prod', namespace: 'payments', resource: 'pods', name: 'api-0', remotePort: 8080, localPort: 0,
                restoreMode: 'connectOnStart',
            }, 1)

            await service.rememberStopped('pf-1', true)

            expect(fileTransport.read(FORWARDS_FILE)[0].isStoppedByUser).toBe(true)
            expect((await service.list())[0]).toMatchObject({ isStoppedByUser: true, status: 'stopped' })

            await service.rememberStopped('pf-1', false)

            expect(fileTransport.read(FORWARDS_FILE)[0].isStoppedByUser).toBe(false)
            expect((await service.list())[0].status).toBe('waiting')
        })

        it('stops and forgets a removed forward', async () => {
            await service.create({
                clusterId: 'prod', namespace: 'payments', resource: 'pods', name: 'api-0', remotePort: 8080, localPort: 0,
            }, 1)
            restTransport.answerWith(pod('api-0'))
            await service.start(forward(), sink)

            await service.remove('pf-1')

            expect(forwards.last.stopped).toBe(true)
            expect(fileTransport.read(FORWARDS_FILE)).toEqual([])
            expect(service.isRunning('pf-1')).toBe(false)
        })
    })

    describe('the ports it offers', () => {
        it('lists every container port of a pod once, with its name and protocol', async () => {
            restTransport.answerWith({
                ...pod('api-0'),
                spec: {
                    initContainers: [{ name: 'init', ports: [{ containerPort: 5000 }] }],
                    containers: [
                        { name: 'app', ports: [{ name: 'http', containerPort: 8080 }, { name: 'dns', containerPort: 53, protocol: 'UDP' }] },
                        { name: 'sidecar', ports: [{ name: 'http', containerPort: 8080 }] },
                    ],
                },
            })

            expect(await service.ports('prod', 'payments', 'pods', 'api-0')).toEqual([
                { port: 5000, name: '', protocol: 'TCP' },
                { port: 8080, name: 'http', protocol: 'TCP' },
                { port: 53, name: 'dns', protocol: 'UDP' },
            ])
        })

        it('lists the ports of a service with their names and protocols', async () => {
            restTransport.answerWith({
                apiVersion: 'v1',
                kind: 'Service',
                metadata: { uid: 'svc-1', name: 'dns', namespace: 'payments' },
                spec: {
                    ports: [
                        { name: 'dns-tcp', port: 53, protocol: 'TCP' },
                        { name: 'dns', port: 53, protocol: 'UDP' },
                        { port: 9153 },
                    ],
                },
            })

            expect(await service.ports('prod', 'payments', 'services', 'dns')).toEqual([
                { port: 53, name: 'dns-tcp', protocol: 'TCP' },
                { port: 53, name: 'dns', protocol: 'UDP' },
                { port: 9153, name: '', protocol: 'TCP' },
            ])
        })
    })

    describe('a pod', () => {
        it('opens the portforward subresource of that pod', async () => {
            restTransport.answerWith(pod('api-0'))

            const runtime = await service.start(forward(), sink)

            const spec = forwards.last.spec
            expect(decodeURIComponent(spec.path)).toBe('/api/v1/namespaces/payments/pods/api-0/portforward?ports=8080')
            expect(spec.sessionId).toBe('session-prod')
            expect(runtime).toEqual({ status: 'active', error: '', boundPort: 34567, podName: 'api-0', targetPort: 8080 })
        })

        it('resolves a named port against the containers of the pod', async () => {
            restTransport.answerWith(pod('api-0', [{ name: 'metrics', containerPort: 9100 }]))

            const runtime = await service.start(forward({ remotePort: 'metrics' }), sink)

            expect(runtime.targetPort).toBe(9100)
        })

        it('refuses a pod that is not there', async () => {
            restTransport.failWith(missing())

            await expect(service.start(forward(), sink)).rejects.toThrow(PortForwardService.podGone)
            expect(forwards.forwards).toHaveLength(0)
        })
    })

    describe('the local port', () => {
        it('keeps a local port the user asked for', async () => {
            restTransport.answerWith(pod('api-0'))

            const runtime = await service.start(forward({ localPort: 18080, lastLocalPort: 40000 }), sink)

            expect(runtime.boundPort).toBe(18080)
            expect(forwards.attempts.map(spec => spec.localPort)).toEqual([18080])
        })

        it('asks the host for any port on a first start', async () => {
            forwards.assignedPort = 41234
            restTransport.answerWith(pod('api-0'))

            const runtime = await service.start(forward(), sink)

            expect(runtime.boundPort).toBe(41234)
            expect(forwards.attempts.map(spec => spec.localPort)).toEqual([0])
        })

        it('takes the port it had last time when it is free', async () => {
            restTransport.answerWith(pod('api-0'))

            const runtime = await service.start(forward({ lastLocalPort: 40001 }), sink)

            expect(runtime.boundPort).toBe(40001)
            expect(forwards.attempts.map(spec => spec.localPort)).toEqual([40001])
        })

        it('falls back to any port when the last one is taken', async () => {
            forwards.takenPorts.add(40001)
            forwards.assignedPort = 41234
            restTransport.answerWith(pod('api-0'))

            const runtime = await service.start(forward({ lastLocalPort: 40001 }), sink)

            expect(runtime.boundPort).toBe(41234)
            expect(forwards.attempts.map(spec => spec.localPort)).toEqual([40001, 0])
        })

        it('fails when the port the user asked for is taken', async () => {
            forwards.takenPorts.add(18080)
            restTransport.answerWith(pod('api-0'))

            await expect(service.start(forward({ localPort: 18080 }), sink)).rejects.toThrow('address already in use')
            expect(forwards.attempts).toHaveLength(1)
        })
    })

    describe('a service', () => {
        it('forwards to a running pod behind it, on the numbered target port', async () => {
            restTransport.answerWith(servicePayload(9090))
            restTransport.answerWith(podList(pod('api-7d5')))

            const runtime = await service.start(svcForward(), sink)

            expect(runtime.podName).toBe('api-7d5')
            expect(runtime.targetPort).toBe(9090)
            expect(decodeURIComponent(forwards.last.spec.path))
                .toBe('/api/v1/namespaces/payments/pods/api-7d5/portforward?ports=9090')
        })

        it('resolves a named target port against the pod that serves it', async () => {
            restTransport.answerWith(servicePayload('http'))
            restTransport.answerWith(podList(pod('api-7d5', [{ name: 'http', containerPort: 9191 }])))

            const runtime = await service.start(svcForward(), sink)

            expect(runtime.targetPort).toBe(9191)
        })

        it('finds the service port by its name', async () => {
            restTransport.answerWith(servicePayload(9090))
            restTransport.answerWith(podList(pod('api-7d5')))

            const runtime = await service.start(svcForward({ remotePort: 'http' }), sink)

            expect(runtime.targetPort).toBe(9090)
        })

        it('refuses a port the service does not declare', async () => {
            restTransport.answerWith(servicePayload(9090))

            await expect(service.start(svcForward({ remotePort: 7070 }), sink)).rejects.toThrow(PortForwardService.noPort)
        })

        it('asks only for running pods that the selector matches', async () => {
            restTransport.answerWith(servicePayload(9090, { app: 'api', tier: 'backend' }))
            restTransport.answerWith(podList(pod('api-7d5')))

            await service.start(svcForward(), sink)

            expect(restTransport.path).toContain('labelSelector=app=api,tier=backend')
            expect(restTransport.path).toContain('fieldSelector=status.phase=Running')
        })

        it('passes over a pod that is already terminating', async () => {
            restTransport.answerWith(servicePayload(9090))
            restTransport.answerWith(podList(pod('api-old', undefined, { deleting: true }), pod('api-new')))

            const runtime = await service.start(svcForward(), sink)

            expect(runtime.podName).toBe('api-new')
        })

        it('refuses when nothing is running behind the service', async () => {
            restTransport.answerWith(servicePayload(9090))
            restTransport.answerWith(podList())

            await expect(service.start(svcForward(), sink)).rejects.toThrow(PortForwardService.noBackend)
            expect(forwards.forwards).toHaveLength(0)
        })
    })

    describe('a pod behind a service that goes away', () => {
        const started = async (): Promise<void> => {
            restTransport.answerWith(servicePayload(9090))
            restTransport.answerWith(podList(pod('api-old')))
            await service.start(svcForward({ lastLocalPort: 40001 }), sink)
        }

        it('moves the listener to the new pod and keeps the local port', async () => {
            await started()
            restTransport.failWith(missing())
            restTransport.answerWith(servicePayload(9090))
            restTransport.answerWith(podList(pod('api-new')))

            await service.recheck('pf-1')

            expect(forwards.forwards).toHaveLength(1)
            expect(forwards.last.stopped).toBe(false)
            expect(forwards.last.targets).toHaveLength(1)
            expect(decodeURIComponent(forwards.last.targets[0].path))
                .toBe('/api/v1/namespaces/payments/pods/api-new/portforward?ports=9090')
            expect(changes[changes.length - 1]).toEqual({
                id: 'pf-1',
                runtime: { status: 'active', error: '', boundPort: 40001, podName: 'api-new', targetPort: 9090 },
            })
        })

        it('moves off a pod that is terminating in a rollout', async () => {
            await started()
            restTransport.answerWith(pod('api-old', undefined, { deleting: true }))
            restTransport.answerWith(servicePayload(9090))
            restTransport.answerWith(podList(pod('api-old', undefined, { deleting: true }), pod('api-new')))

            await service.recheck('pf-1')

            expect(forwards.last.targets[0].path).toContain('api-new')
        })

        it('waits as reconnecting while no pod is running, then comes back', async () => {
            await started()
            restTransport.failWith(missing())
            restTransport.answerWith(servicePayload(9090))
            restTransport.answerWith(podList())

            await service.recheck('pf-1')

            expect(changes[changes.length - 1].runtime.status).toBe('reconnecting')
            expect(changes[changes.length - 1].runtime.error).toBe(PortForwardService.noBackend)
            expect(forwards.last.stopped).toBe(false)

            restTransport.failWith(missing())
            restTransport.answerWith(servicePayload(9090))
            restTransport.answerWith(podList(pod('api-new')))

            await service.recheck('pf-1')

            expect(changes[changes.length - 1].runtime).toMatchObject({ status: 'active', podName: 'api-new', boundPort: 40001 })
        })

        it('leaves a forward alone while its pod is serving', async () => {
            await started()
            restTransport.answerWith(pod('api-old'))

            await service.recheck('pf-1')

            expect(forwards.last.targets).toHaveLength(0)
            expect(changes).toHaveLength(0)
        })

        it('says nothing when the cluster cannot be asked', async () => {
            await started()
            restTransport.failWith(new ApiError('The cluster is unreachable', 'timeout', 0))

            await service.recheck('pf-1')

            expect(changes).toHaveLength(0)
            expect(service.isRunning('pf-1')).toBe(true)
        })

        it('checks the pod as soon as a connection fails', async () => {
            await started()
            restTransport.failWith(missing())
            restTransport.answerWith(servicePayload(9090))
            restTransport.answerWith(podList(pod('api-new')))

            forwards.last.fail('pods "api-old" not found')
            await settle()

            expect(forwards.last.targets[0].path).toContain('api-new')
        })
    })

    describe('a pod that goes away', () => {
        it('ends in error and frees the port', async () => {
            restTransport.answerWith(pod('api-0'))
            await service.start(forward(), sink)
            restTransport.failWith(missing())

            await service.recheck('pf-1')

            expect(forwards.last.stopped).toBe(true)
            expect(service.isRunning('pf-1')).toBe(false)
            expect(changes[changes.length - 1].runtime).toEqual(
                PortForwardRecord.idle('error', 'Pod payments/api-0 was deleted'),
            )
        })
    })

    describe('stopping', () => {
        it('frees the port and forgets the stream registration', async () => {
            restTransport.answerWith(pod('api-0'))
            await service.start(forward(), sink)

            await expect(service.stop('pf-1')).resolves.toBe(true)

            expect(forwards.last.stopped).toBe(true)
            expect(service.isRunning('pf-1')).toBe(false)
            expect(registered).toHaveLength(0)
        })

        it('answers false for a forward that is not running', async () => {
            await expect(service.stop('nothing')).resolves.toBe(false)
        })

        it('restarts a forward that is started again', async () => {
            restTransport.answerWith(pod('api-0'))
            await service.start(forward(), sink)
            restTransport.answerWith(pod('api-0'))
            await service.start(forward({ localPort: 18080 }), sink)

            expect(forwards.forwards).toHaveLength(2)
            expect(forwards.forwards[0].stopped).toBe(true)
            expect(forwards.forwards[1].localPort).toBe(18080)
        })

        it('stops only the forwards of the cluster that went away', async () => {
            connections.set('stage', connection('stage'))
            restTransport.answerWith(pod('api-0'))
            await service.start(forward(), sink)
            restTransport.answerWith(pod('nginx-0'))
            await service.start(forward({ id: 'pf-2', clusterId: 'stage', name: 'nginx-0' }), sink)

            await expect(service.stopCluster('prod')).resolves.toEqual(['pf-1'])

            expect(service.isRunning('pf-1')).toBe(false)
            expect(service.isRunning('pf-2')).toBe(true)
            expect(forwards.forwards[0].stopped).toBe(true)
            expect(forwards.forwards[1].stopped).toBe(false)
        })

        it('is stopped by the stream registry when the cluster disconnects', async () => {
            restTransport.answerWith(pod('api-0'))
            await service.start(forward(), sink)

            await registered[0].stream.stop()

            expect(forwards.last.stopped).toBe(true)
        })
    })

    describe('a listener that dies on its own', () => {
        it('reports the forward as failed with the reason', async () => {
            restTransport.answerWith(pod('api-0'))
            await service.start(forward(), sink)
            restTransport.answerWith(pod('api-0'))

            forwards.last.fail('address already in use')
            forwards.last.end('error')

            expect(service.isRunning('pf-1')).toBe(false)
            expect(changes[changes.length - 1]).toEqual({
                id: 'pf-1',
                runtime: PortForwardRecord.idle('error', 'address already in use'),
            })
        })
    })

    describe('the cluster it cannot forward from', () => {
        it('refuses on a cluster older than the channel protocol', async () => {
            connections.set('old', connection('old', {
                canOpenChannel: false,
                channelBlockReason: 'This cluster runs v1.28 and kubiq needs v1.30',
            }))

            await expect(service.start(forward({ clusterId: 'old' }), sink)).rejects.toThrow('v1.30')
        })

        it('refuses when the cluster is not connected', async () => {
            await expect(service.start(forward({ clusterId: 'gone' }), sink))
                .rejects.toThrow(PortForwardService.notConnected)
        })
    })

    it('opens the forwarded address in the browser', async () => {
        await service.open(forward({ boundPort: 18080 }))
        await service.open(forward())

        expect(opened).toEqual(['http://127.0.0.1:18080'])
    })

    it('copies the forwarded address, the remembered one for a stopped forward', async () => {
        expect(await service.copyAddress(forward({ boundPort: 18080 }))).toBe('127.0.0.1:18080')
        expect(await service.copyAddress(forward({ lastLocalPort: 18081 }))).toBe('127.0.0.1:18081')

        expect(copied).toEqual(['127.0.0.1:18080', '127.0.0.1:18081'])
    })

    it('copies nothing while the forward has no port yet', async () => {
        expect(await service.copyAddress(forward())).toBe('')

        expect(copied).toEqual([])
    })

    it('reads the ports a pod declares', async () => {
        restTransport.answerWith(pod('api-0', [{ name: 'http', containerPort: 8080 }]))

        const ports = await service.ports('prod', 'payments', 'pods', 'api-0')

        expect(ports).toEqual([{ port: 8080, name: 'http', protocol: 'TCP' }])
    })

    it('reads the ports a service declares', async () => {
        restTransport.answerWith(servicePayload(9090))

        const ports = await service.ports('prod', 'payments', 'services', 'api')

        expect(ports).toEqual([{ port: 8080, name: 'http', protocol: 'TCP' }])
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

        it('asks the cluster for nothing until a namespace is chosen', async () => {
            await expect(service.names('prod', '', 'pods')).resolves.toEqual([])
            expect(restTransport.requests).toHaveLength(0)
        })
    })
})
