import { beforeEach, describe, expect, it, vi } from 'vitest'

// Both Wails boundaries are stubbed and nothing between them is: the kubeconfig
// is parsed for real, and what the Go side receives is what a connection would.
const variables: Record<string, string> = {}
const connect = vi.fn()
const disconnect = vi.fn()

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
}))

import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { KubeconfigService } from '@/application/services/kubeconfig/KubeconfigService'
import { ApiError } from '@/domain/errors/ApiError'
import { EntityRepoProvider } from '@/infrastructure/entityRepo/EntityRepoProvider'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { EnvironmentAdapter } from '@/infrastructure/env/EnvironmentAdapter'
import { KubeSessionAdapter } from '@/infrastructure/kube/KubeSessionAdapter'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'
import { MemoryFileTransport } from '../../support/MemoryFileTransport'
import { KubeconfigFixtures } from '../../support/fixtures/KubeconfigFixtures'

const HOME_CONFIG = 'C:/Users/tester/.kube/config'
const WORK_CONFIG = 'D:/work/kubeconfig.yaml'

const runtime = { isAvailable: () => true } as WailsRuntimeService

let transport: MemoryFileTransport
let service: ClusterConnectionService

describe('ClusterConnectionService', () => {
    beforeEach(() => {
        Object.keys(variables).forEach(key => delete variables[key])
        connect.mockReset()
        disconnect.mockReset()
        transport = new MemoryFileTransport()
        transport.files.set(HOME_CONFIG, KubeconfigFixtures.primary())
        transport.files.set(WORK_CONFIG, KubeconfigFixtures.secondary())
        service = new ClusterConnectionService(
            new KubeconfigService(
                new EnvironmentAdapter(runtime),
                new EntityRepoProvider(transport as unknown as FileSystemTransport),
            ),
            new KubeSessionAdapter(runtime),
        )
    })

    it('describes every context the user can choose from', async () => {
        variables.KUBECONFIG = `${HOME_CONFIG};${WORK_CONFIG}`

        const contexts = await service.listContexts()

        expect(contexts.map(context => context.name)).toEqual(['prod', 'staging', 'shared', 'lab'])
        expect(contexts[0]).toEqual({
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

        const contexts = await service.listContexts()

        expect(contexts.filter(context => context.isCurrent).map(context => context.name)).toEqual(['prod'])
    })

    it('falls back to the default namespace in the list', async () => {
        variables.KUBECONFIG = HOME_CONFIG

        const contexts = await service.listContexts()

        expect(contexts.find(context => context.name === 'staging')?.namespace).toBe('default')
    })

    it('says which contexts it cannot use and why', async () => {
        variables.KUBECONFIG = WORK_CONFIG
        transport.files.set(WORK_CONFIG, KubeconfigFixtures.withPlugins())

        const contexts = await service.listContexts()

        expect(contexts.map(context => context.isSupported)).toEqual([false, false])
        expect(contexts[0].unsupportedReason).toContain('later version')
        expect(contexts[1].authType).toBe('authProvider')
    })

    it('opens a session for the chosen context', async () => {
        variables.KUBECONFIG = HOME_CONFIG
        connect.mockResolvedValue({ success: true, sessionId: 'session-1' })

        await expect(service.connect('prod')).resolves.toBe('session-1')

        const spec = connect.mock.calls[0][0]
        expect(spec.server).toBe('https://prod.example.internal:6443')
        expect(spec.caPem).toBe(KubeconfigFixtures.caPem)
        expect(spec.clientCertPem).toBe(KubeconfigFixtures.clientCertPem)
    })

    it('reads the kubeconfig named from outside first', async () => {
        connect.mockResolvedValue({ success: true, sessionId: 'session-2' })

        await expect(service.connect('lab', WORK_CONFIG)).resolves.toBe('session-2')
        expect(connect.mock.calls[0][0].server).toBe('https://shared.example.internal:6443')
    })

    it('never reaches the Go side for a context it cannot build', async () => {
        variables.KUBECONFIG = WORK_CONFIG
        transport.files.set(WORK_CONFIG, KubeconfigFixtures.withPlugins())

        await expect(service.connect('exec')).rejects.toBeInstanceOf(ApiError)
        expect(connect).not.toHaveBeenCalled()
    })

    it('closes a session by id', async () => {
        disconnect.mockResolvedValue({ success: true })

        await service.disconnect('session-1')

        expect(disconnect).toHaveBeenCalledWith('session-1')
    })

    it('reports an open session list', async () => {
        await expect(service.sessions()).resolves.toEqual([])
    })
})
