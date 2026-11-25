import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import type { TRestRequest, TRestResponse } from '@iappx/entity-repo-rest'
import type { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import type { TClusterConnection } from '@/application/services/cluster/types/TClusterConnection'
import type { IdService } from '@/application/services/id/IdService'
import { PodDebugDefaults } from '@/application/services/podDebug/constants/PodDebugDefaults'
import { PodDebugService } from '@/application/services/podDebug/PodDebugService'
import type { SettingsService } from '@/application/services/settings/SettingsService'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import type { KubeHttpAdapter } from '@/infrastructure/kube/KubeHttpAdapter'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'

const restTransport = new MemoryKubeTransport()
const connections = new Map<string, TClusterConnection>()

const connection = (clusterId: string): TClusterConnection => ({
    clusterId,
    contextName: clusterId,
    server: `https://${clusterId}.example`,
    sessionId: `session-${clusterId}`,
    version: 'v1.31.0',
    canOpenChannel: true,
    channelBlockReason: '',
    connectedAt: 0,
})

const connectionService = {
    connection: (clusterId: string) => connections.get(clusterId) ?? null,
    context: () => EntityRepo.create().use(KubeEntityContext, restTransport as never).getContext(KubeEntityContext),
} as unknown as ClusterConnectionService

let configuredImage = 'docker.io/library/alpine:3.20'
const settingsService = {
    nodeShellImage: async () => configuredImage,
} as unknown as SettingsService

const idService = {
    next: () => 'abc123',
} as unknown as IdService

const httpCalls: { sessionId: string, request: TRestRequest }[] = []
const httpQueue: TRestResponse<string>[] = []

const httpAdapter = {
    send: async (sessionId: string, request: TRestRequest): Promise<TRestResponse<string>> => {
        httpCalls.push({ sessionId, request })
        const next = httpQueue.shift()
        if (!next) {
            throw new Error(`No queued HTTP response for ${request.method} ${request.url}`)
        }
        return next
    },
} as unknown as KubeHttpAdapter

const service = new PodDebugService(connectionService, settingsService, idService, httpAdapter)

const okResponse = (body: unknown): TRestResponse<string> => ({
    status: 200,
    headers: {},
    data: JSON.stringify(body),
})

describe('PodDebugService', () => {
    beforeEach(() => {
        restTransport.reset()
        connections.clear()
        connections.set('prod', connection('prod'))
        configuredImage = 'docker.io/library/alpine:3.20'
        httpCalls.length = 0
        httpQueue.length = 0
    })

    it('reads the default debug image from settings', async () => {
        configuredImage = 'registry.internal/debug/tools:1.0'

        expect(await service.defaultImage()).toBe('registry.internal/debug/tools:1.0')
    })

    it('lists regular containers of a pod for the target container picker', async () => {
        restTransport.answerWith({
            apiVersion: 'v1',
            kind: 'Pod',
            metadata: { uid: 'p1', name: 'api-0', namespace: 'payments' },
            spec: {
                initContainers: [{ name: 'migrate' }],
                containers: [{ name: 'app' }, { name: 'sidecar' }],
                ephemeralContainers: [{ name: 'debugger-old' }],
            },
            status: { phase: 'Running' },
        })

        expect(await service.containersOf('prod', 'payments', 'api-0')).toEqual(['app', 'sidecar'])
    })

    it('patches /ephemeralcontainers and polls until the container is running', async () => {
        httpQueue.push(okResponse({}))
        httpQueue.push(okResponse({
            status: {
                ephemeralContainerStatuses: [
                    { name: 'debugger-abc123', state: { running: { startedAt: '2026-10-01T10:00:00Z' } } },
                ],
            },
        }))

        const result = await service.attach({
            clusterId: 'prod',
            namespace: 'payments',
            podName: 'api-0',
            image: 'docker.io/library/alpine:3.20',
            targetContainerName: 'app',
        })

        expect(result).toEqual({
            containerName: 'debugger-abc123',
            image: 'docker.io/library/alpine:3.20',
        })
        expect(httpCalls).toHaveLength(2)
        expect(httpCalls[0].sessionId).toBe('session-prod')
        expect(httpCalls[0].request).toEqual({
            method: 'PATCH',
            url: '/api/v1/namespaces/payments/pods/api-0/ephemeralcontainers',
            headers: {
                'content-type': PodDebugDefaults.strategicMergePatchType,
            },
            body: {
                spec: {
                    ephemeralContainers: [{
                        name: 'debugger-abc123',
                        image: 'docker.io/library/alpine:3.20',
                        stdin: true,
                        tty: true,
                        targetContainerName: 'app',
                    }],
                },
            },
        })
        expect(httpCalls[1].request).toEqual({
            method: 'GET',
            url: '/api/v1/namespaces/payments/pods/api-0',
        })
    })

    it('rejects an empty debug image before sending any request', async () => {
        await expect(service.attach({
            clusterId: 'prod',
            namespace: 'payments',
            podName: 'api-0',
            image: '   ',
        })).rejects.toThrow(PodDebugService.missingImage)

        expect(httpCalls).toHaveLength(0)
    })

    it('fails cleanly when the cluster is not connected', async () => {
        connections.clear()

        await expect(service.attach({
            clusterId: 'prod',
            namespace: 'payments',
            podName: 'api-0',
            image: 'alpine:3.20',
        })).rejects.toThrow(PodDebugService.notConnected)
    })

    it('turns Kubernetes 403, 404 and 422 patch errors into clear ApiErrors', async () => {
        for (const [status, reason, message] of [
            [403, 'Forbidden', 'pods "api-0" is forbidden: cannot patch pods/ephemeralcontainers'],
            [404, 'NotFound', 'the server could not find the requested resource'],
            [422, 'Invalid', 'Pod "api-0" is invalid: targetContainerName not found'],
        ] as const) {
            httpQueue.length = 0
            httpQueue.push({
                status,
                headers: {},
                data: JSON.stringify({ kind: 'Status', status: 'Failure', code: status, reason, message }),
            })

            await expect(service.attach({
                clusterId: 'prod',
                namespace: 'payments',
                podName: 'api-0',
                image: 'alpine:3.20',
            })).rejects.toMatchObject({
                name: 'ApiError',
                status,
                message,
                details: reason,
            })
        }
    })

    it('fails when the ephemeral container terminates before becoming ready', async () => {
        httpQueue.push(okResponse({}))
        httpQueue.push(okResponse({
            status: {
                ephemeralContainerStatuses: [
                    { name: 'debugger-abc123', state: { terminated: { reason: 'ImagePullBackOff' } } },
                ],
            },
        }))

        const caught = await service.attach({
            clusterId: 'prod',
            namespace: 'payments',
            podName: 'api-0',
            image: 'missing:latest',
        }).catch(err => err)

        expect(caught).toBeInstanceOf(ApiError)
        expect((caught as ApiError).message).toBe(PodDebugService.notReady)
        expect((caught as ApiError).details).toBe('ImagePullBackOff')
    })

    it('gives up when the container stays waiting past the deadline', async () => {
        httpQueue.push(okResponse({}))
        httpQueue.push(okResponse({
            status: {
                ephemeralContainerStatuses: [
                    { name: 'debugger-abc123', state: { waiting: { reason: 'ContainerCreating' } } },
                ],
            },
        }))

        let tick = 0
        await expect(service.attach({
            clusterId: 'prod',
            namespace: 'payments',
            podName: 'api-0',
            image: 'alpine:3.20',
        }, () => {
            tick += 120_000
            return tick
        })).rejects.toThrow(PodDebugService.notReady)
    })

    it('rejects with cancelled error before patching when signal is already aborted', async () => {
        const controller = new AbortController()
        controller.abort()

        const caught = await service.attach({
            clusterId: 'prod',
            namespace: 'payments',
            podName: 'api-0',
            image: 'alpine:3.20',
            signal: controller.signal,
        }).catch(err => err)

        expect(caught).toBeInstanceOf(ApiError)
        expect(PodDebugService.isCancelled(caught)).toBe(true)
        expect((caught as ApiError).message).toBe(PodDebugService.cancelled)
        expect(httpCalls).toHaveLength(0)
    })

    it('stops polling immediately without leaking timers when aborted during wait', async () => {
        vi.useFakeTimers()
        try {
            httpQueue.push(okResponse({}))
            httpQueue.push(okResponse({
                status: {
                    ephemeralContainerStatuses: [
                        { name: 'debugger-abc123', state: { waiting: { reason: 'ContainerCreating' } } },
                    ],
                },
            }))

            const controller = new AbortController()
            const pending = service.attach({
                clusterId: 'prod',
                namespace: 'payments',
                podName: 'api-0',
                image: 'alpine:3.20',
                signal: controller.signal,
            })

            for (let i = 0; i < 10 && vi.getTimerCount() === 0; i += 1) {
                await Promise.resolve()
            }

            expect(httpCalls).toHaveLength(2)
            expect(vi.getTimerCount()).toBe(1)

            controller.abort()

            const caught = await pending.catch(err => err)
            expect(caught).toBeInstanceOf(ApiError)
            expect(PodDebugService.isCancelled(caught)).toBe(true)
            expect(httpCalls).toHaveLength(2)
            expect(vi.getTimerCount()).toBe(0)
        } finally {
            vi.useRealTimers()
        }
    })

    it('distinguishes cancellation errors from other errors via isCancelled', () => {
        expect(PodDebugService.isCancelled(new ApiError(PodDebugService.cancelled))).toBe(true)
        expect(PodDebugService.isCancelled(new ApiError(PodDebugService.notReady))).toBe(false)
        expect(PodDebugService.isCancelled(new Error(PodDebugService.cancelled))).toBe(false)
    })
})
