import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { ClipboardService } from '@/application/services/clipboard/ClipboardService'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { PodLogsService } from '@/application/services/podLogs/PodLogsService'
import type { IPodLogSink } from '@/application/services/podLogs/types/IPodLogSink'
import type { TPodLogOpenRequest } from '@/application/services/podLogs/types/TPodLogOpenRequest'
import { ApiError } from '@/domain/errors/ApiError'
import { PodLogOptions } from '@/domain/models/kube'
import type { TPodLogState } from '@/domain/models/kube'
import { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import type { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import type { IClusterStream } from '@/infrastructure/kube/types/IClusterStream'
import { MemoryKubeStreamTransport } from '../../support/MemoryKubeStreamTransport'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'

const streamTransport = new MemoryKubeStreamTransport()
const restTransport = new MemoryKubeTransport()

const registered: { clusterId: string, stream: IClusterStream }[] = []
const written: { path: string, content?: string }[] = []
const copied: string[] = []

const connectionService = {
    stream: () => streamTransport,
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

const files = {
    send: async (params: { path: string, content?: string }) => {
        written.push(params)
        return null
    },
} as unknown as FileSystemTransport

const clipboard = {
    write: async (text: string) => {
        copied.push(text)
    },
} as unknown as ClipboardService

const lines: string[] = []
const states: { state: TPodLogState, failure: string }[] = []

const sink: IPodLogSink = {
    onLines: (key, lineCount, dropped) => lines.push(`${key}:${lineCount}:${dropped}`),
    onState: (key, state, failure) => states.push({ state, failure }),
}

const request = (overrides: Partial<TPodLogOpenRequest> = {}): TPodLogOpenRequest => ({
    key: 'logs|prod|payments|api-0|app',
    clusterId: 'prod',
    namespace: 'payments',
    podName: 'api-0',
    options: PodLogOptions.defaults('app'),
    ...overrides,
})

let service: PodLogsService

describe('PodLogsService', () => {
    beforeEach(() => {
        streamTransport.reset()
        restTransport.reset()
        registered.length = 0
        written.length = 0
        copied.length = 0
        lines.length = 0
        states.length = 0
        service = new PodLogsService(connectionService, clipboard, files)
    })

    it('opens the log subresource with the options it was given', async () => {
        await service.open(request(), sink)

        expect(streamTransport.path).toContain('/api/v1/namespaces/payments/pods/api-0/log')
        expect(streamTransport.path).toContain('container=app')
        expect(streamTransport.path).toContain('follow=true')
    })

    it('turns the chunks it receives into lines', async () => {
        await service.open(request(), sink)

        streamTransport.last.chunk('one\ntwo\n')

        expect([...service.lines(request().key)]).toEqual(['one', 'two'])
    })

    it('joins a line the cluster split across two chunks', async () => {
        await service.open(request(), sink)

        streamTransport.last.chunk('level=info msg="star')
        streamTransport.last.chunk('ted"\n')

        expect([...service.lines(request().key)]).toEqual(['level=info msg="started"'])
    })

    it('reports the first lines as the moment the stream became live', async () => {
        await service.open(request(), sink)

        streamTransport.last.chunk('hello\n')

        expect(states).toContainEqual({ state: 'streaming', failure: '' })
        expect(lines).toContain('logs|prod|payments|api-0|app:1:0')
    })

    it('is live from the first chunk, before any line is complete', async () => {
        await service.open(request(), sink)

        streamTransport.last.chunk('a line with no newline yet')

        expect(states[states.length - 1]).toEqual({ state: 'streaming', failure: '' })
        expect(service.lines(request().key)).toHaveLength(0)
    })

    // Kubernetes closes a followed log when its container goes away.
    it('calls a followed stream that ended cleanly a restart', async () => {
        await service.open(request(), sink)

        streamTransport.last.chunk('bye\n')
        streamTransport.last.end('eof')

        expect(states[states.length - 1]).toEqual({ state: 'restarted', failure: '' })
    })

    it('calls an unfollowed stream that ended cleanly an ending', async () => {
        await service.open(request({ options: PodLogOptions.defaults('app', true) }), sink)

        streamTransport.last.end('eof')

        expect(states[states.length - 1]).toEqual({ state: 'ended', failure: '' })
    })

    it('carries the reason a stream failed into the state', async () => {
        await service.open(request(), sink)

        streamTransport.last.fail('The connection was interrupted', 'unexpected EOF')
        streamTransport.last.end('error')

        expect(states[states.length - 1].state).toBe('failed')
        expect(states[states.length - 1].failure).toContain('unexpected EOF')
    })

    it('keeps the last unfinished line when the stream ends', async () => {
        await service.open(request(), sink)

        streamTransport.last.chunk('done\nhalf')
        streamTransport.last.end('eof')

        expect([...service.lines(request().key)]).toEqual(['done', 'half'])
    })

    it('stops the stream when its tab closes', async () => {
        await service.open(request(), sink)
        const stream = streamTransport.last

        await service.close(request().key)

        expect(stream.stopped).toBe(true)
        expect(service.has(request().key)).toBe(false)
    })

    it('ignores chunks that arrive after the tab closed', async () => {
        await service.open(request(), sink)
        const stream = streamTransport.last

        await service.close(request().key)
        stream.chunk('late\n')

        expect(service.lines(request().key)).toHaveLength(0)
    })

    it('registers every stream so disconnecting the cluster can drain it', async () => {
        await service.open(request(), sink)

        expect(registered).toHaveLength(1)
        expect(registered[0].clusterId).toBe('prod')
    })

    it('unregisters the stream when the tab closes', async () => {
        await service.open(request(), sink)

        await service.close(request().key)

        expect(registered).toHaveLength(0)
    })

    it('is stopped by the registered stream itself', async () => {
        await service.open(request(), sink)
        const held = registered[0].stream
        const stream = streamTransport.last

        await held.stop()

        expect(stream.stopped).toBe(true)
    })

    it('reopening the same key replaces the stream rather than doubling it', async () => {
        await service.open(request(), sink)
        const first = streamTransport.last

        await service.open(request({ options: PodLogOptions.defaults('app', true) }), sink)

        expect(first.stopped).toBe(true)
        expect(streamTransport.streams).toHaveLength(2)
        expect(registered).toHaveLength(1)
    })

    it('closes every stream belonging to one cluster and leaves the others', async () => {
        await service.open(request(), sink)
        await service.open(request({ key: 'logs|prod|payments|api-1|app', podName: 'api-1' }), sink)
        await service.open(request({ key: 'logs|lab|payments|api-0|app', clusterId: 'lab' }), sink)

        await service.closeCluster('prod')

        expect(service.has('logs|prod|payments|api-0|app')).toBe(false)
        expect(service.has('logs|prod|payments|api-1|app')).toBe(false)
        expect(service.has('logs|lab|payments|api-0|app')).toBe(true)
    })

    it('keeps no session behind when the cluster refuses the stream', async () => {
        streamTransport.refusal = new ApiError('Could not open the stream', 'pods "api-0" not found')

        await expect(service.open(request(), sink)).rejects.toBeInstanceOf(ApiError)

        expect(service.has(request().key)).toBe(false)
        expect(registered).toHaveLength(0)
    })

    it('lists init containers before the ones that keep running', async () => {
        restTransport.answerWith({
            metadata: { uid: 'api-0', name: 'api-0', namespace: 'payments' },
            spec: {
                initContainers: [{ name: 'migrate' }],
                containers: [{ name: 'app' }, { name: 'sidecar' }],
            },
        })

        const containers = await service.containers('prod', 'payments', 'api-0')

        expect(containers).toEqual([
            { name: 'migrate', isInit: true },
            { name: 'app', isInit: false },
            { name: 'sidecar', isInit: false },
        ])
    })

    it('asks for the one pod it needs', async () => {
        restTransport.answerWith({ metadata: { uid: 'api-0', name: 'api-0' }, spec: { containers: [] } })

        await service.containers('prod', 'payments', 'api-0')

        expect(restTransport.path).toBe('/api/v1/namespaces/payments/pods/api-0')
    })

    it('saves the buffer to a file under the user data directory', async () => {
        await service.open(request(), sink)
        streamTransport.last.chunk('one\ntwo\n')

        const path = await service.save(request().key, new Date(2026, 8, 21, 14, 32, 5))

        expect(path).toBe('userdata:logs/payments_api-0_app_20260921-143205.log')
        expect(written[0].content).toBe('one\ntwo')
    })

    it('copies the buffer as text', async () => {
        await service.open(request(), sink)
        streamTransport.last.chunk('one\ntwo\n')

        await service.copy(request().key)

        expect(copied).toEqual(['one\ntwo'])
    })
})
