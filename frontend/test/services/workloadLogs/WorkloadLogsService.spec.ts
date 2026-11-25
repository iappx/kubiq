import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import type { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import type { ResourceYamlService } from '@/application/services/resourceYaml/ResourceYamlService'
import type { TResourceObjectRequest } from '@/application/services/resourceYaml/types/TResourceObjectRequest'
import { WorkloadLogsService } from '@/application/services/workloadLogs/WorkloadLogsService'
import { KubeResourceRegistry } from '@/domain/models/kube'
import { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'

const restTransport = new MemoryKubeTransport()

const connectionService = {
    context: () => EntityRepo.create().use(KubeEntityContext, restTransport as never).getContext(KubeEntityContext),
} as unknown as ClusterConnectionService

let manifest: Record<string, unknown> = {}
const yamlRequests: TResourceObjectRequest[] = []

const yamlService = {
    read: async (request: TResourceObjectRequest) => {
        yamlRequests.push(request)
        return manifest
    },
} as unknown as ResourceYamlService

const service = new WorkloadLogsService(connectionService, yamlService)

const kind = (group: string, resource: string) => KubeResourceRegistry.find(group, resource)!

describe('WorkloadLogsService', () => {
    beforeEach(() => {
        restTransport.reset()
        yamlRequests.length = 0
        manifest = {}
    })

    it('reads the workload selector, queries matching pods and returns them sorted with health tones', async () => {
        manifest = {
            metadata: { name: 'api', namespace: 'payments' },
            spec: { selector: { matchLabels: { app: 'api' } } },
        }
        restTransport.answerWith({
            apiVersion: 'v1',
            kind: 'PodList',
            metadata: { resourceVersion: '1' },
            items: [
                {
                    apiVersion: 'v1',
                    kind: 'Pod',
                    metadata: { uid: 'u1', name: 'api-failed', namespace: 'payments', creationTimestamp: '2026-10-01T12:00:00Z' },
                    spec: { nodeName: 'node-b', containers: [{ name: 'app' }] },
                    status: { phase: 'Failed' },
                },
                {
                    apiVersion: 'v1',
                    kind: 'Pod',
                    metadata: { uid: 'u2', name: 'api-live', namespace: 'payments', creationTimestamp: '2026-10-01T10:00:00Z' },
                    spec: { nodeName: 'node-a', containers: [{ name: 'app' }, { name: 'proxy' }] },
                    status: {
                        phase: 'Running',
                        containerStatuses: [
                            { name: 'app', ready: true, state: { running: {} } },
                            { name: 'proxy', ready: true, state: { running: {} } },
                        ],
                    },
                },
            ],
        })

        const choices = await service.podsOf('prod', kind('apps', 'deployments'), 'api', 'payments')

        expect(yamlRequests).toHaveLength(1)
        expect(restTransport.last.url).toBe('/api/v1/namespaces/payments/pods')
        expect(restTransport.last.query?.labelSelector).toBe('app=api')
        expect(choices).toEqual([
            {
                name: 'api-live',
                namespace: 'payments',
                phase: 'Running',
                tone: 'ok',
                nodeName: 'node-a',
                containers: ['app', 'proxy'],
            },
            {
                name: 'api-failed',
                namespace: 'payments',
                phase: 'Failed',
                tone: 'error',
                nodeName: 'node-b',
                containers: ['app'],
            },
        ])
    })

    it('returns an empty list without querying pods when the workload has no selector', async () => {
        manifest = { metadata: { name: 'api', namespace: 'payments' }, spec: {} }

        const choices = await service.podsOf('prod', kind('apps', 'deployments'), 'api', 'payments')

        expect(choices).toEqual([])
        expect(restTransport.requests).toHaveLength(0)
    })

    it('falls back to job-name when a Job omits matchLabels', async () => {
        manifest = { metadata: { name: 'backup-1', namespace: 'ops' }, spec: {} }
        restTransport.answerWith({
            apiVersion: 'v1',
            kind: 'PodList',
            metadata: { resourceVersion: '1' },
            items: [],
        })

        await service.podsOf('prod', kind('batch', 'jobs'), 'backup-1', 'ops')

        expect(restTransport.last.query?.labelSelector).toBe('job-name=backup-1')
    })

    it('queries pods using matchExpressions selectors', async () => {
        manifest = {
            metadata: { name: 'worker', namespace: 'ops' },
            spec: {
                selector: {
                    matchExpressions: [
                        { key: 'app', operator: 'In', values: ['worker', 'queue'] },
                        { key: 'canary', operator: 'DoesNotExist' },
                    ],
                },
            },
        }
        restTransport.answerWith({
            apiVersion: 'v1',
            kind: 'PodList',
            metadata: { resourceVersion: '1' },
            items: [],
        })

        await service.podsOf('prod', kind('apps', 'deployments'), 'worker', 'ops')

        expect(restTransport.last.query?.labelSelector).toBe('app in (worker,queue),!canary')
    })
})
