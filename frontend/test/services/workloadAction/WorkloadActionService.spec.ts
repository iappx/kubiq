import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { WorkloadActionService } from '@/application/services/workloadAction/WorkloadActionService'
import { WorkloadAnnotations } from '@/application/services/workloadAction/constants/WorkloadAnnotations'
import type { TWorkloadTarget } from '@/application/services/workloadAction/types/TWorkloadTarget'
import { CronJobEntity } from '@/domain/entities/workloads'
import { KubeResourceRegistry } from '@/domain/models/kube'
import { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import { KubePatchRequestFactory } from '@/infrastructure/entityRepo/kube/strategies/KubePatchRequestFactory'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'

const transport = new MemoryKubeTransport()

const deployments = KubeResourceRegistry.find('apps', 'deployments')!
const cronJobs = KubeResourceRegistry.find('batch', 'cronjobs')!
const jobs = KubeResourceRegistry.find('batch', 'jobs')!

const connectionService = {
    context: () => EntityRepo.create().use(KubeEntityContext, transport as never).getContext(KubeEntityContext),
} as unknown as ClusterConnectionService

const target: TWorkloadTarget = {
    clusterId: 'prod',
    kind: deployments,
    name: 'api',
    namespace: 'payments',
    rowKey: 'api-uid',
}

const body = () => (transport.last.body ?? {}) as Record<string, any>

const cronJob = () => CronJobEntity.build({
    uid: 'cron-uid',
    apiVersion: 'batch/v1',
    kind: 'CronJob',
    metadata: { uid: 'cron-uid', name: 'nightly-report', namespace: 'payments' },
    spec: {
        schedule: '0 2 * * *',
        jobTemplate: {
            metadata: { labels: { app: 'report' } },
            spec: { backoffLimit: 2, template: { spec: { containers: [{ name: 'report' }] } } },
        },
    },
})

let service: WorkloadActionService

describe('WorkloadActionService.scale', () => {
    beforeEach(() => {
        transport.reset()
        service = new WorkloadActionService(connectionService)
    })

    it('patches the object by name and namespace', async () => {
        transport.answerWith({})

        await service.scale(target, 3)

        expect(transport.last.url).toBe('/apis/apps/v1/namespaces/payments/deployments/api')
        expect(transport.last.method).toBe('PATCH')
    })

    it('sends the replica count and nothing else', async () => {
        transport.answerWith({})

        await service.scale(target, 3)

        expect(body()).toEqual({ spec: { replicas: 3 } })
    })

    it('scales to zero, which is a number like any other', async () => {
        transport.answerWith({})

        await service.scale(target, 0)

        expect(body()).toEqual({ spec: { replicas: 0 } })
    })

    it('asks for a merge patch, which is what a set of changed fields means', async () => {
        transport.answerWith({})

        await service.scale(target, 1)

        expect(transport.last.headers?.['content-type']).toBe(KubePatchRequestFactory.mergePatchType)
    })
})

describe('WorkloadActionService.restart', () => {
    beforeEach(() => {
        transport.reset()
        service = new WorkloadActionService(connectionService)
    })

    it('stamps the pod template annotation kubectl uses', async () => {
        transport.answerWith({})

        await service.restart(target, new Date('2026-09-21T18:30:00.000Z'))

        expect(body()).toEqual({
            spec: {
                template: {
                    metadata: {
                        annotations: { [WorkloadAnnotations.restartedAt]: '2026-09-21T18:30:00.000Z' },
                    },
                },
            },
        })
    })

    it('addresses the object being restarted', async () => {
        transport.answerWith({})

        await service.restart(target)

        expect(transport.last.url).toBe('/apis/apps/v1/namespaces/payments/deployments/api')
    })
})

describe('WorkloadActionService.trigger', () => {
    beforeEach(() => {
        transport.reset()
        service = new WorkloadActionService(connectionService)
    })

    it('creates a job in the namespace of the cron job', async () => {
        transport.answerWith({ metadata: { uid: 'job-uid', name: 'nightly-report-x7k2p', namespace: 'payments' } })

        await service.trigger({ clusterId: 'prod', cronJob: cronJob(), jobKind: jobs })

        expect(transport.last.url).toBe('/apis/batch/v1/namespaces/payments/jobs')
        expect(transport.last.method).toBe('POST')
    })

    it('copies the job template and marks the run as manual', async () => {
        transport.answerWith({ metadata: { uid: 'job-uid', name: 'nightly-report-x7k2p' } })

        await service.trigger({ clusterId: 'prod', cronJob: cronJob(), jobKind: jobs })

        expect(body()).toMatchObject({
            apiVersion: 'batch/v1',
            kind: 'Job',
            metadata: {
                generateName: 'nightly-report-manual-',
                namespace: 'payments',
                labels: { app: 'report' },
                annotations: { [WorkloadAnnotations.instantiate]: WorkloadAnnotations.manual },
            },
            spec: { backoffLimit: 2, template: { spec: { containers: [{ name: 'report' }] } } },
        })
    })

    it('owns the job by the cron job that was triggered', async () => {
        transport.answerWith({ metadata: { uid: 'job-uid', name: 'nightly-report-x7k2p' } })

        await service.trigger({ clusterId: 'prod', cronJob: cronJob(), jobKind: jobs })

        expect(body().metadata.ownerReferences).toEqual([{
            apiVersion: 'batch/v1',
            kind: 'CronJob',
            name: 'nightly-report',
            uid: 'cron-uid',
            controller: false,
            blockOwnerDeletion: true,
        }])
    })

    it('reports the name the cluster gave the run', async () => {
        transport.answerWith({ metadata: { uid: 'job-uid', name: 'nightly-report-x7k2p', namespace: 'payments' } })

        const name = await service.trigger({ clusterId: 'prod', cronJob: cronJob(), jobKind: jobs })

        expect(name).toBe('nightly-report-x7k2p')
    })

    // 58 is the 63-character DNS-1123 label limit less the five characters the API server appends.
    it('leaves the API server room for its suffix on a long name', () => {
        const prefix = WorkloadActionService.generatedPrefix('a'.repeat(120))

        expect(prefix.length).toBeLessThanOrEqual(58)
        expect(prefix.endsWith(WorkloadActionService.manualSuffix)).toBe(true)
    })

    it('leaves a short name alone', () => {
        expect(WorkloadActionService.generatedPrefix('nightly')).toBe('nightly-manual-')
    })

    it('reads the schedule and template off the cron job it was handed', () => {
        expect(cronJobs.kind).toBe('CronJob')
        expect(cronJob().jobTemplateSpec).toMatchObject({ backoffLimit: 2 })
        expect(cronJob().jobTemplateLabels).toEqual({ app: 'report' })
    })
})
