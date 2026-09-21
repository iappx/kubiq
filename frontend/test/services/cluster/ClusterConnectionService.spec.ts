import { beforeEach, describe, expect, it, vi } from 'vitest'

const variables: Record<string, string> = {}
const connect = vi.fn()
const disconnect = vi.fn()
const send = vi.fn()

vi.mock('../../../bindings/iappx_k8s_admin/core/services/env', () => ({
    EnvService: {
        Get: (name: string) => Promise.resolve(
            name in variables
                ? { success: true, value: variables[name] }
                : { success: false, value: '', error: 'environment variable is not set' },
        ),
        UserHomeDir: () => Promise.resolve({ success: true, value: 'C:/Users/tester' }),
        PathSeparator: () => Promise.resolve({ success: true, value: ';' }),
        Expand: (path: string) => Promise.resolve({ success: true, value: path }),
    },
}))

vi.mock('../../../bindings/iappx_k8s_admin/core/services/kube', () => ({
    ConnectionService: {
        Connect: (...args: unknown[]) => connect(...args),
        Disconnect: (...args: unknown[]) => disconnect(...args),
        Sessions: () => Promise.resolve({ success: true, sessions: [] }),
    },
    KubeService: {
        Send: (...args: unknown[]) => send(...args),
    },
    Request: class {
        constructor(source: Record<string, unknown>) {
            Object.assign(this, source)
        }
    },
    StreamRequest: class {},
}))

import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { KubeconfigService } from '@/application/services/kubeconfig/KubeconfigService'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeResourceKind, KubeResourceRegistry } from '@/domain/models/kube'
import { EntityRepoProvider } from '@/infrastructure/entityRepo/EntityRepoProvider'
import { KubeContextProvider } from '@/infrastructure/entityRepo/kube/KubeContextProvider'
import { KubeQueryMeta } from '@/infrastructure/entityRepo/kube/KubeQueryMeta'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { EnvironmentAdapter } from '@/infrastructure/env/EnvironmentAdapter'
import { KubeSessionAdapter } from '@/infrastructure/kube/KubeSessionAdapter'
import { KubeStreamRegistry } from '@/infrastructure/kube/KubeStreamRegistry'
import { KubeVersionAdapter } from '@/infrastructure/kube/KubeVersionAdapter'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { KubeHealthMonitor } from '@/infrastructure/kube/KubeHealthMonitor'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'
import { MemoryFileTransport } from '../../support/MemoryFileTransport'
import { KubeconfigFixtures } from '../../support/fixtures/KubeconfigFixtures'

const HOME_CONFIG = 'C:/Users/tester/.kube/config'
const WORK_CONFIG = 'D:/work/kubeconfig.yaml'

const runtime = { isAvailable: () => true } as WailsRuntimeService
const pods = KubeResourceRegistry.find('', 'pods') as KubeResourceKind

let transport: MemoryFileTransport
let contexts: KubeContextProvider
let streams: KubeStreamRegistry
let service: ClusterConnectionService

const versionOf = (gitVersion: string, major: string, minor: string): string => JSON.stringify({
    major,
    minor,
    gitVersion,
})

const sessionsInOrder = (...ids: string[]): void => {
    ids.forEach(id => connect.mockResolvedValueOnce({ success: true, sessionId: id }))
}

const stubStream = (): { stop: () => Promise<void>, stopped: number } => {
    const stream = {
        stopped: 0,
        stop: () => {
            stream.stopped++
            return Promise.resolve()
        },
    }
    return stream
}

describe('ClusterConnectionService', () => {
    beforeEach(() => {
        Object.keys(variables).forEach(key => delete variables[key])
        connect.mockReset()
        disconnect.mockReset()
        send.mockReset()
        disconnect.mockResolvedValue({ success: true })
        send.mockResolvedValue({
            success: true,
            status: 200,
            headers: {},
            body: versionOf('v1.31.2', '1', '31'),
            error: '',
        })

        transport = new MemoryFileTransport()
        transport.files.set(HOME_CONFIG, KubeconfigFixtures.primary())
        transport.files.set(WORK_CONFIG, KubeconfigFixtures.secondary())

        contexts = new KubeContextProvider(runtime, new KubeHealthMonitor(new EventBus()))
        streams = new KubeStreamRegistry()
        service = new ClusterConnectionService(
            new KubeconfigService(
                new EnvironmentAdapter(runtime),
                new EntityRepoProvider(transport as unknown as FileSystemTransport),
            ),
            new KubeSessionAdapter(runtime),
            contexts,
            streams,
            new KubeVersionAdapter(contexts),
        )
    })

    describe('reading the catalog', () => {
        it('describes every context the user can choose from', async () => {
            variables.KUBECONFIG = `${HOME_CONFIG};${WORK_CONFIG}`

            const list = await service.listContexts()

            expect(list.map(context => context.name)).toEqual(['prod', 'staging', 'shared', 'lab'])
            expect(list[0]).toEqual({
                name: 'prod',
                filePath: HOME_CONFIG,
                clusterName: 'prod',
                server: 'https://prod.example.internal:6443',
                namespace: 'payments',
                authType: 'clientCertificate',
                isCurrent: true,
                isSupported: true,
                unsupportedReason: '',
            })
        })

        it('marks the context of a file that names none as not current', async () => {
            variables.KUBECONFIG = `${HOME_CONFIG};${WORK_CONFIG}`

            const list = await service.listContexts()

            expect(list.filter(context => context.isCurrent).map(context => context.name)).toEqual(['prod'])
        })

        it('falls back to the default namespace in the list', async () => {
            variables.KUBECONFIG = HOME_CONFIG

            const list = await service.listContexts()

            expect(list.find(context => context.name === 'staging')?.namespace).toBe('default')
        })

        it('says which contexts it cannot use and why', async () => {
            variables.KUBECONFIG = WORK_CONFIG
            transport.files.set(WORK_CONFIG, KubeconfigFixtures.withPlugins())

            const list = await service.listContexts()

            expect(list.map(context => context.isSupported)).toEqual([false, false])
            expect(list[0].unsupportedReason).toContain('later version')
            expect(list[1].authType).toBe('authProvider')
        })

        it('reads the extra kubeconfig files it is handed', async () => {
            const list = await service.listContexts([WORK_CONFIG])

            expect(list.map(context => context.name)).toContain('lab')
        })
    })

    describe('connecting', () => {
        it('opens a session for the chosen context', async () => {
            variables.KUBECONFIG = HOME_CONFIG
            sessionsInOrder('session-1')

            const connection = await service.connect('prod')

            expect(connection.clusterId).toBe('prod')
            expect(connection.sessionId).toBe('session-1')
            expect(connection.server).toBe('https://prod.example.internal:6443')

            const spec = connect.mock.calls[0][0]
            expect(spec.caPem).toBe(KubeconfigFixtures.caPem)
            expect(spec.clientCertPem).toBe(KubeconfigFixtures.clientCertPem)
        })

        it('reads the kubeconfig named from outside first', async () => {
            sessionsInOrder('session-2')

            const connection = await service.connect('lab', [WORK_CONFIG])

            expect(connection.server).toBe('https://shared.example.internal:6443')
        })

        it('never reaches the Go side for a context it cannot build', async () => {
            variables.KUBECONFIG = WORK_CONFIG
            transport.files.set(WORK_CONFIG, KubeconfigFixtures.withPlugins())

            await expect(service.connect('exec')).rejects.toBeInstanceOf(ApiError)
            expect(connect).not.toHaveBeenCalled()
        })

        it('leaves an unreachable cluster out of the open connections', async () => {
            variables.KUBECONFIG = HOME_CONFIG
            connect.mockResolvedValue({ success: false, sessionId: '', error: 'dial tcp: i/o timeout' })

            const failure = await service.connect('prod').catch(err => err)

            expect(failure).toBeInstanceOf(ApiError)
            expect((failure as ApiError).details).toContain('i/o timeout')
            expect(service.isConnected('prod')).toBe(false)
            expect(service.connections).toEqual([])
        })

        it('closes the previous session when the same context is connected again', async () => {
            variables.KUBECONFIG = HOME_CONFIG
            sessionsInOrder('session-1', 'session-2')

            await service.connect('prod')
            const second = await service.connect('prod')

            expect(disconnect).toHaveBeenCalledWith('session-1')
            expect(second.sessionId).toBe('session-2')
            expect(service.connections).toHaveLength(1)
        })
    })

    describe('the server version', () => {
        it('keeps what the cluster reported on the connection', async () => {
            variables.KUBECONFIG = HOME_CONFIG
            sessionsInOrder('session-1')

            const connection = await service.connect('prod')

            expect(connection.version).toBe('v1.31.2')
            expect(connection.canOpenChannel).toBe(true)
            expect(connection.channelBlockReason).toBe('')
        })

        it('refuses exec and port forwarding below 1.30 with something to act on', async () => {
            variables.KUBECONFIG = HOME_CONFIG
            sessionsInOrder('session-1')
            send.mockResolvedValue({
                success: true,
                status: 200,
                headers: {},
                body: versionOf('v1.27.9', '1', '27'),
                error: '',
            })

            const connection = await service.connect('prod')

            expect(connection.canOpenChannel).toBe(false)
            expect(connection.channelBlockReason).toContain('1.30 or newer')
            expect(connection.channelBlockReason).toContain('1.27')
            expect(connection.channelBlockReason).toContain('kubectl exec')

            expect(() => service.assertChannelAllowed('prod')).toThrow(ApiError)
        })

        it('stays connected when the cluster will not say which version it runs', async () => {
            variables.KUBECONFIG = HOME_CONFIG
            sessionsInOrder('session-1')
            send.mockResolvedValue({ success: false, status: 403, headers: {}, body: '', error: 'forbidden' })

            const connection = await service.connect('prod')

            expect(service.isConnected('prod')).toBe(true)
            expect(connection.canOpenChannel).toBe(false)
            expect(connection.channelBlockReason).toContain('/version')
        })

        it('lets a supported cluster through the channel gate', async () => {
            variables.KUBECONFIG = HOME_CONFIG
            sessionsInOrder('session-1')

            await service.connect('prod')

            expect(service.canOpenChannel('prod')).toBe(true)
            expect(() => service.assertChannelAllowed('prod')).not.toThrow()
        })
    })

    describe('two clusters at once', () => {
        beforeEach(() => {
            variables.KUBECONFIG = `${HOME_CONFIG};${WORK_CONFIG}`
            sessionsInOrder('session-prod', 'session-lab')
        })

        it('keeps a context of its own per cluster', async () => {
            await service.connect('prod')
            await service.connect('lab')

            expect(service.context('prod')).not.toBe(service.context('lab'))
            expect(service.connections.map(open => open.clusterId)).toEqual(['prod', 'lab'])
        })

        it('sends each cluster its own session id', async () => {
            await service.connect('prod')
            await service.connect('lab')
            send.mockResolvedValue({ success: true, status: 200, headers: {}, body: '{"items":[]}', error: '' })

            await service.context('prod').resources.withMeta(KubeQueryMeta.forKind(pods)).getAll()
            await service.context('lab').resources.withMeta(KubeQueryMeta.forKind(pods)).getAll()

            const sessions = send.mock.calls.slice(-2).map(call => call[0].sessionId)
            expect(sessions).toEqual(['session-prod', 'session-lab'])
        })

        it('leaves the other cluster untouched when one disconnects', async () => {
            await service.connect('prod')
            await service.connect('lab')
            const labContext = service.context('lab')

            await service.disconnect('prod')

            expect(service.isConnected('prod')).toBe(false)
            expect(service.isConnected('lab')).toBe(true)
            expect(service.context('lab')).toBe(labContext)
            expect(disconnect).toHaveBeenCalledWith('session-prod')
            expect(disconnect).not.toHaveBeenCalledWith('session-lab')
        })

        it('stops only the streams of the cluster that disconnects', async () => {
            await service.connect('prod')
            await service.connect('lab')

            const prodWatch = stubStream()
            const prodShell = stubStream()
            const labWatch = stubStream()
            service.registerStream('prod', prodWatch)
            service.registerStream('prod', prodShell)
            service.registerStream('lab', labWatch)

            expect(service.openStreams('prod')).toBe(2)

            await service.disconnect('prod')

            expect(prodWatch.stopped).toBe(1)
            expect(prodShell.stopped).toBe(1)
            expect(labWatch.stopped).toBe(0)
            expect(service.openStreams('prod')).toBe(0)
            expect(service.openStreams('lab')).toBe(1)
        })
    })

    describe('disconnecting', () => {
        beforeEach(() => {
            variables.KUBECONFIG = HOME_CONFIG
            sessionsInOrder('session-1')
        })

        it('reports what it closed', async () => {
            await service.connect('prod')

            const closed = await service.disconnect('prod')

            expect(closed?.sessionId).toBe('session-1')
            expect(disconnect).toHaveBeenCalledWith('session-1')
        })

        it('answers with nothing for a cluster that was never connected', async () => {
            await expect(service.disconnect('ghost')).resolves.toBeNull()
            expect(disconnect).not.toHaveBeenCalled()
        })

        it('releases the entity context so a reconnect cannot reuse the dead session', async () => {
            await service.connect('prod')
            expect(contexts.has('prod')).toBe(true)

            await service.disconnect('prod')

            expect(contexts.has('prod')).toBe(false)
        })

        it('releases the context even when the Go side refuses to close the session', async () => {
            await service.connect('prod')
            disconnect.mockResolvedValue({ success: false, error: 'session already gone' })

            await expect(service.disconnect('prod')).rejects.toBeInstanceOf(ApiError)

            expect(contexts.has('prod')).toBe(false)
            expect(service.isConnected('prod')).toBe(false)
        })

        it('stops the remaining streams when a stream refuses to stop', async () => {
            await service.connect('prod')
            const healthy = stubStream()
            service.registerStream('prod', { stop: () => Promise.reject(new Error('socket already closed')) })
            service.registerStream('prod', healthy)

            await service.disconnect('prod')

            expect(healthy.stopped).toBe(1)
            expect(service.isConnected('prod')).toBe(false)
        })

        it('closes every cluster at once', async () => {
            connect.mockResolvedValueOnce({ success: true, sessionId: 'session-2' })
            await service.connect('prod')
            await service.connect('staging')

            await service.disconnectAll()

            expect(service.connections).toEqual([])
            expect(contexts.has('prod')).toBe(false)
            expect(contexts.has('staging')).toBe(false)
        })
    })

    describe('asking about a cluster that is not connected', () => {
        it('names the cluster and what to do', () => {
            expect(() => service.context('ghost')).toThrow(ApiError)
            expect(() => service.assertChannelAllowed('ghost')).toThrow(/not connected/i)
        })

        it('reports an open session list', async () => {
            await expect(service.sessions()).resolves.toEqual([])
        })
    })
})
