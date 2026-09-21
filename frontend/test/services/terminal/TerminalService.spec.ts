import { beforeEach, describe, expect, it } from 'vitest'
import type { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import type { TClusterConnection } from '@/application/services/cluster/types/TClusterConnection'
import type { LocalShellService } from '@/application/services/localShell/LocalShellService'
import type { TLocalShellPlan } from '@/application/services/localShell/types/TLocalShellPlan'
import type { NodeShellService } from '@/application/services/nodeShell/NodeShellService'
import type { TNodeShellPod } from '@/application/services/nodeShell/types/TNodeShellPod'
import { TerminalService } from '@/application/services/terminal/TerminalService'
import { TerminalTools } from '@/application/services/terminal/constants/TerminalTools'
import type { ITerminalSink } from '@/application/services/terminal/types/ITerminalSink'
import { ApiError } from '@/domain/errors/ApiError'
import { TerminalBytes } from '@/domain/models/terminal'
import type { TTerminalHint, TTerminalState } from '@/domain/models/terminal'
import type { KubeChannelAdapter } from '@/infrastructure/channel/KubeChannelAdapter'
import type { HostShellAdapter } from '@/infrastructure/process/HostShellAdapter'
import type { PtyAdapter } from '@/infrastructure/process/PtyAdapter'
import type { IClusterStream } from '@/infrastructure/kube/types/IClusterStream'
import { MemoryChannelAdapter } from '../../support/MemoryChannelAdapter'
import { MemoryPtyAdapter } from '../../support/MemoryPtyAdapter'

const channels = new MemoryChannelAdapter()
const ptys = new MemoryPtyAdapter()

const registered: { clusterId: string, stream: IClusterStream }[] = []
const connections = new Map<string, TClusterConnection>()

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

let plan: TLocalShellPlan = {
    command: 'powershell.exe',
    args: ['-NoLogo'],
    env: { KUBECONFIG: 'C:\\profile\\kubiq\\shell\\prod.kubeconfig;C:\\home\\.kube\\config' },
    kubectl: { name: 'kubectl', path: 'C:\\tools\\kubectl.exe', source: 'path' },
}

const localShellService = {
    prepare: async () => plan,
} as unknown as LocalShellService

const nodeShell = {
    created: [] as TNodeShellPod[],
    removed: [] as TNodeShellPod[],
    swept: [] as string[],
    kept: [] as string[][],
    readyFailure: null as Error | null,
}

const nodeShellService = {
    sweep: async (clusterId: string, keep: readonly string[] = []) => {
        nodeShell.swept.push(clusterId)
        nodeShell.kept.push([...keep])
        return 0
    },
    create: async (clusterId: string, nodeName: string) => {
        const pod: TNodeShellPod = {
            name: `node-shell-${nodeName}-abc123`,
            namespace: 'kube-system',
            nodeName,
            image: 'docker.io/library/alpine:3.20',
        }
        nodeShell.created.push(pod)
        return pod
    },
    waitReady: async () => {
        if (nodeShell.readyFailure) {
            throw nodeShell.readyFailure
        }
    },
    remove: async (clusterId: string, pod: TNodeShellPod) => {
        nodeShell.removed.push(pod)
    },
} as unknown as NodeShellService

const host = { openUri: async () => undefined } as unknown as HostShellAdapter

const states: { key: string, state: TTerminalState, failure: string, hint: TTerminalHint }[] = []

const sink: ITerminalSink = {
    onState: (key, state, failure, hint) => states.push({ key, state, failure, hint }),
}

const stateOf = (key: string): { state: TTerminalState, failure: string, hint: TTerminalHint } | undefined => {
    const seen = states.filter(entry => entry.key === key)
    return seen[seen.length - 1]
}

const service = new TerminalService(
    connectionService,
    localShellService,
    nodeShellService,
    channels as unknown as KubeChannelAdapter,
    ptys as unknown as PtyAdapter,
    host,
)

describe('TerminalService', () => {
    beforeEach(async () => {
        await service.closeAll()
        channels.reset()
        ptys.reset()
        registered.length = 0
        states.length = 0
        connections.clear()
        connections.set('prod', connection('prod'))
        nodeShell.created.length = 0
        nodeShell.removed.length = 0
        nodeShell.swept.length = 0
        nodeShell.kept.length = 0
        nodeShell.readyFailure = null
        plan = {
            command: 'powershell.exe',
            args: ['-NoLogo'],
            env: { KUBECONFIG: 'overlay;config' },
            kubectl: { name: 'kubectl', path: 'C:\\tools\\kubectl.exe', source: 'path' },
        }
    })

    describe('exec into a container', () => {
        it('asks the API server for an interactive exec on that container', async () => {
            await service.openExec('term|prod|1', {
                clusterId: 'prod',
                namespace: 'payments',
                podName: 'api-0',
                containerName: 'app',
            }, sink)

            const path = channels.paths[0]

            expect(path).toContain('/api/v1/namespaces/payments/pods/api-0/exec')
            expect(path).toContain('container=app')
            expect(path).toContain('stdin=true')
            expect(path).toContain('tty=true')
            expect(channels.last.spec.sessionId).toBe('session-prod')
        })

        // A TTY and a separate stderr together are refused by the API server.
        it('never asks for stderr alongside a tty', async () => {
            await service.openExec('term|prod|1', {
                clusterId: 'prod',
                namespace: 'payments',
                podName: 'api-0',
                containerName: '',
            }, sink)

            expect(channels.paths[0]).toContain('stderr=false')
            expect(channels.paths[0]).not.toContain('container=')
        })

        it('reports running as soon as the channel is open', async () => {
            await service.openExec('term|prod|1', {
                clusterId: 'prod', namespace: 'payments', podName: 'api-0', containerName: 'app',
            }, sink)

            expect(stateOf('term|prod|1')?.state).toBe('running')
        })

        it('replays what arrived before the view was attached', async () => {
            await service.openExec('term|prod|1', {
                clusterId: 'prod', namespace: 'payments', podName: 'api-0', containerName: 'app',
            }, sink)

            channels.last.data('# ready\r\n')

            const seen: string[] = []
            service.attachView('term|prod|1', data => seen.push(new TextDecoder().decode(data)))

            expect(seen.join('')).toBe('# ready\r\n')
        })

        it('sends typed input and the window size to its own channel', async () => {
            await service.openExec('term|prod|1', {
                clusterId: 'prod', namespace: 'payments', podName: 'api-0', containerName: 'app',
            }, sink)

            await service.write('term|prod|1', TerminalBytes.fromText('ls -la\r'))
            await service.resize('term|prod|1', 120, 40)

            expect(channels.last.written).toBe('ls -la\r')
            expect(channels.last.resizes).toEqual([{ cols: 120, rows: 40 }])
        })

        // Otherwise every keystroke after the session died raises its own error toast.
        it('drops input typed after the session ended', async () => {
            await service.openExec('term|prod|1', {
                clusterId: 'prod', namespace: 'payments', podName: 'api-0', containerName: 'app',
            }, sink)

            channels.last.end('eof', '')
            await service.write('term|prod|1', TerminalBytes.fromText('too late'))

            expect(channels.last.written).toBe('')
        })

        it('ends the session when the cluster closes the channel', async () => {
            await service.openExec('term|prod|1', {
                clusterId: 'prod', namespace: 'payments', podName: 'api-0', containerName: 'app',
            }, sink)

            channels.last.end('eof', '{"status":"Success"}')

            expect(stateOf('term|prod|1')?.state).toBe('ended')
            expect(stateOf('term|prod|1')?.failure).toBe('')
        })

        it('shows what the cluster said when the channel dies', async () => {
            await service.openExec('term|prod|1', {
                clusterId: 'prod', namespace: 'payments', podName: 'api-0', containerName: 'app',
            }, sink)

            channels.last.end('error', '{"status":"Failure","message":"command terminated with exit code 1"}')

            expect(stateOf('term|prod|1')?.state).toBe('failed')
            expect(stateOf('term|prod|1')?.failure).toBe('command terminated with exit code 1')
        })
    })

    describe('several terminals at once', () => {
        it('keeps two clusters' + ' sessions apart', async () => {
            connections.set('stage', connection('stage'))

            await service.openExec('term|prod|1', {
                clusterId: 'prod', namespace: 'payments', podName: 'api-0', containerName: 'app',
            }, sink)
            await service.openExec('term|stage|1', {
                clusterId: 'stage', namespace: 'web', podName: 'nginx-0', containerName: 'nginx',
            }, sink)

            const [first, second] = channels.channels

            expect(first.spec.sessionId).toBe('session-prod')
            expect(second.spec.sessionId).toBe('session-stage')

            await service.write('term|prod|1', TerminalBytes.fromText('prod'))
            await service.write('term|stage|1', TerminalBytes.fromText('stage'))

            expect(first.written).toBe('prod')
            expect(second.written).toBe('stage')
        })

        it('routes output to the view of the terminal it belongs to', async () => {
            connections.set('stage', connection('stage'))

            await service.openExec('term|prod|1', {
                clusterId: 'prod', namespace: 'payments', podName: 'api-0', containerName: 'app',
            }, sink)
            await service.openExec('term|stage|1', {
                clusterId: 'stage', namespace: 'web', podName: 'nginx-0', containerName: 'nginx',
            }, sink)

            const prodSeen: string[] = []
            const stageSeen: string[] = []
            service.attachView('term|prod|1', data => prodSeen.push(new TextDecoder().decode(data)))
            service.attachView('term|stage|1', data => stageSeen.push(new TextDecoder().decode(data)))

            channels.channels[0].data('from prod')
            channels.channels[1].data('from stage')

            expect(prodSeen.join('')).toBe('from prod')
            expect(stageSeen.join('')).toBe('from stage')
        })

        it('registers every session against its own cluster', async () => {
            connections.set('stage', connection('stage'))

            await service.openExec('term|prod|1', {
                clusterId: 'prod', namespace: 'payments', podName: 'api-0', containerName: 'app',
            }, sink)
            await service.openLocalShell('term|stage|2', { clusterId: 'stage', namespace: 'web' }, sink)

            expect(registered.map(entry => entry.clusterId)).toEqual(['prod', 'stage'])
        })

        it('closes only the sessions of the cluster that went away', async () => {
            connections.set('stage', connection('stage'))

            await service.openExec('term|prod|1', {
                clusterId: 'prod', namespace: 'payments', podName: 'api-0', containerName: 'app',
            }, sink)
            await service.openExec('term|stage|1', {
                clusterId: 'stage', namespace: 'web', podName: 'nginx-0', containerName: 'nginx',
            }, sink)

            await service.closeCluster('prod')

            expect(channels.channels[0].closed).toBe(true)
            expect(channels.channels[1].closed).toBe(false)
            expect(service.has('term|prod|1')).toBe(false)
            expect(service.has('term|stage|1')).toBe(true)
        })
    })

    describe('closing', () => {
        it('releases the channel and forgets the stream registration', async () => {
            await service.openExec('term|prod|1', {
                clusterId: 'prod', namespace: 'payments', podName: 'api-0', containerName: 'app',
            }, sink)

            await service.close('term|prod|1')

            expect(channels.last.closed).toBe(true)
            expect(registered).toHaveLength(0)
            expect(service.has('term|prod|1')).toBe(false)
        })

        it('is safe to close a key it never opened', async () => {
            await expect(service.close('term|prod|missing')).resolves.toBeUndefined()
        })

        it('closes everything it holds', async () => {
            await service.openExec('term|prod|1', {
                clusterId: 'prod', namespace: 'payments', podName: 'api-0', containerName: 'app',
            }, sink)
            await service.openLocalShell('term|prod|2', { clusterId: 'prod', namespace: '' }, sink)

            await service.closeAll()

            expect(channels.last.closed).toBe(true)
            expect(ptys.last.killed).toBe(true)
            expect(registered).toHaveLength(0)
        })
    })

    describe('the cluster the shell cannot be opened on', () => {
        it('says why on a cluster older than the channel protocol', async () => {
            connections.set('old', connection('old', {
                canOpenChannel: false,
                channelBlockReason: 'This cluster runs v1.28 and kubiq needs v1.30',
            }))

            await service.openExec('term|old|1', {
                clusterId: 'old', namespace: 'payments', podName: 'api-0', containerName: 'app',
            }, sink)

            expect(stateOf('term|old|1')?.hint).toBe('unsupported')
            expect(stateOf('term|old|1')?.failure).toBe('This cluster runs v1.28 and kubiq needs v1.30')
            expect(channels.channels).toHaveLength(0)
        })

        it('says the window cannot do this when there is no desktop bridge', async () => {
            channels.available = false

            await service.openExec('term|prod|1', {
                clusterId: 'prod', namespace: 'payments', podName: 'api-0', containerName: 'app',
            }, sink)

            expect(stateOf('term|prod|1')?.hint).toBe('desktop')
            expect(channels.channels).toHaveLength(0)
        })

        it('says the cluster is not connected', async () => {
            await service.openExec('term|gone|1', {
                clusterId: 'gone', namespace: 'payments', podName: 'api-0', containerName: 'app',
            }, sink)

            expect(stateOf('term|gone|1')?.state).toBe('failed')
            expect(stateOf('term|gone|1')?.failure).toBe(TerminalService.notConnected)
        })

        it('leaves the failure on screen and rethrows when the channel is refused', async () => {
            channels.refusal = new ApiError('Could not open a channel to the cluster', 'forbidden')

            await expect(service.openExec('term|prod|1', {
                clusterId: 'prod', namespace: 'payments', podName: 'api-0', containerName: 'app',
            }, sink)).rejects.toThrow('Could not open a channel')

            expect(stateOf('term|prod|1')?.state).toBe('failed')
            expect(stateOf('term|prod|1')?.failure).toContain('forbidden')
        })
    })

    describe('local shell', () => {
        it('starts the shell the plan names, with its environment', async () => {
            await service.openLocalShell('term|prod|1', { clusterId: 'prod', namespace: 'payments' }, sink)

            expect(ptys.last.spec.command).toBe('powershell.exe')
            expect(ptys.last.spec.args).toEqual(['-NoLogo'])
            expect(ptys.last.spec.env?.KUBECONFIG).toBe('overlay;config')
            expect(stateOf('term|prod|1')?.state).toBe('running')
        })

        it('does not start a shell when kubectl is nowhere to be found', async () => {
            plan = { ...plan, kubectl: { name: 'kubectl', path: '', source: 'none' } }

            await service.openLocalShell('term|prod|1', { clusterId: 'prod', namespace: '' }, sink)

            expect(ptys.processes).toHaveLength(0)
            expect(stateOf('term|prod|1')?.hint).toBe('kubectl')
            expect(stateOf('term|prod|1')?.failure).toBe(TerminalTools.kubectlMissing)
        })

        it('does not need a connected cluster', async () => {
            connections.clear()

            await service.openLocalShell('term|prod|1', { clusterId: 'prod', namespace: '' }, sink)

            expect(ptys.processes).toHaveLength(1)
        })

        it('reports the exit code the shell left with', async () => {
            await service.openLocalShell('term|prod|1', { clusterId: 'prod', namespace: '' }, sink)

            ptys.last.exit(130)

            expect(stateOf('term|prod|1')?.state).toBe('ended')
            expect(stateOf('term|prod|1')?.failure).toContain('130')
        })

        it('kills the process when the tab closes', async () => {
            await service.openLocalShell('term|prod|1', { clusterId: 'prod', namespace: '' }, sink)

            await service.close('term|prod|1')

            expect(ptys.last.killed).toBe(true)
        })
    })

    describe('node shell', () => {
        it('clears whatever a previous run left behind before creating its own pod', async () => {
            await service.openNodeShell('term|prod|1', { clusterId: 'prod', nodeName: 'worker-1' }, sink)

            expect(nodeShell.swept).toEqual(['prod'])
            expect(nodeShell.created).toHaveLength(1)
            expect(nodeShell.created[0].nodeName).toBe('worker-1')
        })

        // attach, not exec: the pod's own stdin is what stdinOnce closes when we go away.
        it('attaches to the pod it created', async () => {
            await service.openNodeShell('term|prod|1', { clusterId: 'prod', nodeName: 'worker-1' }, sink)

            const path = channels.paths[0]

            expect(path).toContain('/api/v1/namespaces/kube-system/pods/node-shell-worker-1-abc123/attach')
            expect(path).toContain('container=shell')
            expect(path).not.toContain('/exec')
        })

        // Without this a second node shell would delete the pod of the first one.
        it('does not sweep away a node shell this window still holds open', async () => {
            await service.openNodeShell('term|prod|1', { clusterId: 'prod', nodeName: 'worker-1' }, sink)
            await service.openNodeShell('term|prod|2', { clusterId: 'prod', nodeName: 'worker-2' }, sink)

            expect(nodeShell.kept[0]).toEqual([])
            expect(nodeShell.kept[1]).toEqual(['node-shell-worker-1-abc123'])
        })

        it('stops keeping a pod once its tab is closed', async () => {
            await service.openNodeShell('term|prod|1', { clusterId: 'prod', nodeName: 'worker-1' }, sink)
            await service.close('term|prod|1')

            await service.openNodeShell('term|prod|2', { clusterId: 'prod', nodeName: 'worker-2' }, sink)

            expect(nodeShell.kept[1]).toEqual([])
        })

        it('removes the pod when the tab closes', async () => {
            await service.openNodeShell('term|prod|1', { clusterId: 'prod', nodeName: 'worker-1' }, sink)

            await service.close('term|prod|1')

            expect(nodeShell.removed).toHaveLength(1)
            expect(nodeShell.removed[0].name).toBe('node-shell-worker-1-abc123')
            expect(channels.last.closed).toBe(true)
        })

        it('removes the pod when disconnecting the cluster stops the session', async () => {
            await service.openNodeShell('term|prod|1', { clusterId: 'prod', nodeName: 'worker-1' }, sink)

            await registered[0].stream.stop()

            expect(nodeShell.removed).toHaveLength(1)
        })

        // A pod that never came up is exactly the case where the pod is left behind.
        it('removes the pod when it never becomes ready', async () => {
            nodeShell.readyFailure = new ApiError('The node shell pod did not start', 'still Pending')

            await expect(service.openNodeShell('term|prod|1', {
                clusterId: 'prod',
                nodeName: 'worker-1',
            }, sink)).rejects.toThrow('did not start')

            expect(nodeShell.removed).toHaveLength(1)
            expect(stateOf('term|prod|1')?.state).toBe('failed')
        })
    })
})
