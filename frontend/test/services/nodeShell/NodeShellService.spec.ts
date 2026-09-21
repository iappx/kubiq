import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import type { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import type { IdService } from '@/application/services/id/IdService'
import { NodeShellService } from '@/application/services/nodeShell/NodeShellService'
import type { SettingsService } from '@/application/services/settings/SettingsService'
import { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'

const restTransport = new MemoryKubeTransport()
const connected = new Set<string>(['prod'])

const connectionService = {
    isConnected: (clusterId: string) => connected.has(clusterId),
    context: () => EntityRepo.create().use(KubeEntityContext, restTransport as never).getContext(KubeEntityContext),
} as unknown as ClusterConnectionService

let image = 'docker.io/library/alpine:3.20'

const settingsService = { nodeShellImage: async () => image } as unknown as SettingsService
const idService = { next: () => 'abc123def' } as unknown as IdService

const service = new NodeShellService(connectionService, settingsService, idService)

const pod = (name: string, phase: string = 'Running'): unknown => ({
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { uid: `uid-${name}`, name, namespace: 'kube-system' },
    spec: {},
    status: { phase },
})

describe('NodeShellService', () => {
    beforeEach(() => {
        restTransport.reset()
        connected.clear()
        connected.add('prod')
        image = 'docker.io/library/alpine:3.20'
    })

    describe('create', () => {
        it('posts the pod into the system namespace', async () => {
            restTransport.answerWith(pod('node-shell-worker-1-abc123'))

            const created = await service.create('prod', 'worker-1')

            expect(restTransport.last.method).toBe('POST')
            expect(restTransport.last.url).toBe('/api/v1/namespaces/kube-system/pods')
            expect(created.name).toBe('node-shell-worker-1-abc123')
            expect(created.namespace).toBe('kube-system')
        })

        it('sends the whole manifest, privileges and all', async () => {
            restTransport.answerWith(pod('node-shell-worker-1-abc123'))

            await service.create('prod', 'worker-1')

            const body = restTransport.last.body as Record<string, any>

            expect(body.spec.nodeName).toBe('worker-1')
            expect(body.spec.hostPID).toBe(true)
            expect(body.spec.containers[0].securityContext).toEqual({ privileged: true })
            expect(body.spec.containers[0].stdinOnce).toBe(true)
            expect(body.metadata.labels['kubiq.dev/component']).toBe('node-shell')
        })

        // A closed network replaces the image in the settings rather than rebuilding.
        it('takes the image the settings hold', async () => {
            image = 'registry.internal/ops/alpine:3.20'
            restTransport.answerWith(pod('node-shell-worker-1-abc123'))

            const created = await service.create('prod', 'worker-1')
            const body = restTransport.last.body as Record<string, any>

            expect(created.image).toBe('registry.internal/ops/alpine:3.20')
            expect(body.spec.containers[0].image).toBe('registry.internal/ops/alpine:3.20')
        })
    })

    describe('waitReady', () => {
        it('returns as soon as the pod runs', async () => {
            restTransport.answerWith(pod('node-shell-worker-1-abc123'))

            await expect(service.waitReady('prod', {
                name: 'node-shell-worker-1-abc123',
                namespace: 'kube-system',
                nodeName: 'worker-1',
                image,
            })).resolves.toBeUndefined()

            expect(restTransport.last.url).toBe('/api/v1/namespaces/kube-system/pods/node-shell-worker-1-abc123')
        })

        it('gives up on a pod that has already finished', async () => {
            restTransport.answerWith(pod('node-shell-worker-1-abc123', 'Failed'))

            await expect(service.waitReady('prod', {
                name: 'node-shell-worker-1-abc123',
                namespace: 'kube-system',
                nodeName: 'worker-1',
                image,
            })).rejects.toThrow(NodeShellService.notReady)
        })

        it('gives up once its own deadline passes', async () => {
            restTransport.answerWith(pod('node-shell-worker-1-abc123', 'Pending'))
            let now = 0

            await expect(service.waitReady('prod', {
                name: 'node-shell-worker-1-abc123',
                namespace: 'kube-system',
                nodeName: 'worker-1',
                image,
            }, () => {
                now += 120_000
                return now
            })).rejects.toThrow(NodeShellService.notReady)
        })
    })

    describe('sweep', () => {
        it('deletes what an earlier run of the application left behind', async () => {
            restTransport.answerWith({
                apiVersion: 'v1',
                kind: 'PodList',
                metadata: { resourceVersion: '1' },
                items: [pod('node-shell-worker-1-old111'), pod('node-shell-worker-2-old222')],
            })
            restTransport.answerWith({})
            restTransport.answerWith({})

            const removed = await service.sweep('prod')

            expect(removed).toBe(2)
            expect(restTransport.requests[0].query?.labelSelector)
                .toBe('app.kubernetes.io/managed-by=kubiq,kubiq.dev/component=node-shell')
            expect(restTransport.requests.slice(1).map(request => request.method)).toEqual(['DELETE', 'DELETE'])
        })

        it('leaves the pods of shells this window still holds open alone', async () => {
            restTransport.answerWith({
                apiVersion: 'v1',
                kind: 'PodList',
                metadata: { resourceVersion: '1' },
                items: [pod('node-shell-worker-1-old111'), pod('node-shell-worker-2-keep22')],
            })
            restTransport.answerWith({})

            const removed = await service.sweep('prod', ['node-shell-worker-2-keep22'])

            expect(removed).toBe(1)
            expect(restTransport.last.url).toBe('/api/v1/namespaces/kube-system/pods/node-shell-worker-1-old111')
        })

        it('does nothing on a cluster that is no longer connected', async () => {
            connected.clear()

            expect(await service.sweep('prod')).toBe(0)
            expect(restTransport.requests).toHaveLength(0)
        })
    })

    it('does not try to delete the pod of a cluster that is already gone', async () => {
        connected.clear()

        await service.remove('prod', {
            name: 'node-shell-worker-1-abc123',
            namespace: 'kube-system',
            nodeName: 'worker-1',
            image,
        })

        expect(restTransport.requests).toHaveLength(0)
    })

    it('lists the nodes a shell can be opened on, in order', async () => {
        restTransport.answerWith({
            apiVersion: 'v1',
            kind: 'NodeList',
            metadata: { resourceVersion: '1' },
            items: [
                { apiVersion: 'v1', kind: 'Node', metadata: { uid: '2', name: 'worker-2' }, spec: {}, status: {} },
                { apiVersion: 'v1', kind: 'Node', metadata: { uid: '1', name: 'control-1' }, spec: {}, status: {} },
            ],
        })

        expect(await service.listNodes('prod')).toEqual(['control-1', 'worker-2'])
    })
})
