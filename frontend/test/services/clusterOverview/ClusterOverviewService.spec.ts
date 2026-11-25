import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { ClusterOverviewService } from '@/application/services/clusterOverview/ClusterOverviewService'
import { ClusterOverviewLimits } from '@/application/services/clusterOverview/constants/ClusterOverviewLimits'
import { ResourceListService } from '@/application/services/resourceList/ResourceListService'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeCrdReader, KubeResourceRegistry } from '@/domain/models/kube'
import { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'

const transport = new MemoryKubeTransport()

const nodes = KubeResourceRegistry.find('', 'nodes')!
const pods = KubeResourceRegistry.find('', 'pods')!
const deployments = KubeResourceRegistry.find('apps', 'deployments')!
const cronJobs = KubeResourceRegistry.find('batch', 'cronjobs')!
const jobs = KubeResourceRegistry.find('batch', 'jobs')!
const events = KubeResourceRegistry.find('', 'events')!

const kustomizations = KubeCrdReader.read({
    spec: {
        group: 'kustomize.toolkit.fluxcd.io',
        scope: 'Namespaced',
        names: { plural: 'kustomizations', kind: 'Kustomization' },
        versions: [{ name: 'v1', served: true }],
    },
})[0]

const connectionService = {
    context: () => EntityRepo.create().use(KubeEntityContext, transport as never).getContext(KubeEntityContext),
} as unknown as ClusterConnectionService

const pod = (name: string, ready: boolean, phase = 'Running', cpuRequest = '250m') => ({
    metadata: { uid: name, name, namespace: 'payments' },
    spec: { containers: [{ name: 'app', resources: { requests: { cpu: cpuRequest, memory: '256Mi' } } }] },
    status: {
        phase,
        containerStatuses: [{ name: 'app', ready, restartCount: 0 }],
    },
})

const node = (name: string, ready: boolean, unschedulable = false) => ({
    metadata: { uid: name, name },
    spec: { unschedulable },
    status: {
        capacity: { cpu: '4', memory: '8Gi', pods: '110' },
        allocatable: { cpu: '3800m', memory: '7Gi', pods: '110' },
        conditions: [{ type: 'Ready', status: ready ? 'True' : 'False' }],
    },
})

const warning = (name: string, lastTimestamp: string) => ({
    metadata: { uid: name, name, namespace: 'payments' },
    type: 'Warning',
    reason: 'BackOff',
    message: 'Back-off restarting failed container',
    count: 4,
    involvedObject: { kind: 'Pod', name: 'api-0' },
    lastTimestamp,
})

let service: ClusterOverviewService

const request = (kinds = [pods, deployments, nodes, events]) => ({
    clusterId: 'prod',
    kinds,
    namespaces: [] as string[],
})

describe('ClusterOverviewService', () => {
    beforeEach(() => {
        transport.reset()
        service = new ClusterOverviewService(new ResourceListService(connectionService))
    })

    it('summarises served overview kinds, computes healthy counts and notes, and reuses nodes and pods without duplicate fetches', async () => {
        transport.answerWith({ metadata: {}, items: [node('node-a', true)] })
        transport.answerWith({
            metadata: {},
            items: [
                pod('api-0', true),
                pod('api-1', false),
                pod('job-pod', false, 'Succeeded'),
            ],
        })
        transport.answerWith({ metadata: {}, items: [] })
        transport.answerWith({ metadata: {}, items: [] })

        const overview = await service.load(request())

        expect(transport.requests).toHaveLength(4)
        expect(overview.workloads.map(summary => summary.title)).toEqual(['Nodes', 'Pods', 'Deployments'])
        expect(overview.workloads[0]).toMatchObject({ total: 1, healthy: 1, problems: 0, error: '' })
        expect(overview.workloads[1]).toMatchObject({
            total: 3,
            healthy: 2,
            problems: 1,
            warnings: 1,
            errors: 0,
            note: '1 completed',
            error: '',
        })
        expect(overview.capacity.nodeCount).toBe(1)
        expect(overview.capacity.cpuCapacityCores).toBe(4)
        expect(overview.capacity.podsAllocated).toBe(2)
        expect(overview.capacity.cpuRequestedCores).toBeCloseTo(0.5)
        expect(overview.pods).toHaveLength(3)
    })

    it('includes cron job paused notes, job complete notes, and Flux CRD readiness', async () => {
        transport.answerWith({
            metadata: {},
            items: [
                { metadata: { uid: 'c1', name: 'nightly', namespace: 'ops' }, spec: { schedule: '0 0 * * *', suspend: true }, status: {} },
                { metadata: { uid: 'c2', name: 'hourly', namespace: 'ops' }, spec: { schedule: '0 * * * *', suspend: false }, status: {} },
            ],
        })
        transport.answerWith({
            metadata: {},
            items: [
                { metadata: { uid: 'j1', name: 'migrate', namespace: 'ops' }, spec: { completions: 1 }, status: { succeeded: 1, conditions: [{ type: 'Complete', status: 'True' }] } },
            ],
        })
        transport.answerWith({
            metadata: {},
            items: [
                { metadata: { uid: 'k1', name: 'apps', namespace: 'flux-system' }, status: { conditions: [{ type: 'Ready', status: 'True' }] } },
                { metadata: { uid: 'k2', name: 'infra', namespace: 'flux-system' }, status: { conditions: [{ type: 'Ready', status: 'False' }] } },
            ],
        })

        const overview = await service.load(request([cronJobs, jobs, kustomizations]))

        expect(overview.workloads.map(summary => summary.title)).toEqual(['Cron Jobs', 'Jobs', 'Kustomization'])
        expect(overview.workloads[0]).toMatchObject({ total: 2, healthy: 1, problems: 0, note: '1 paused' })
        expect(overview.workloads[1]).toMatchObject({ total: 1, healthy: 1, problems: 0, note: '1 complete' })
        expect(overview.workloads[2]).toMatchObject({ total: 2, healthy: 1, problems: 1, errors: 1 })
    })

    it('leaves out a kind the cluster does not serve', async () => {
        transport.answerWith({ metadata: {}, items: [] })
        transport.answerWith({ metadata: {}, items: [] })

        const overview = await service.load(request([pods, nodes]))

        expect(overview.workloads.map(summary => summary.title)).toEqual(['Nodes', 'Pods'])
    })

    it('prefers what the cluster says the collection holds over what it sent', async () => {
        transport.answerWith({ metadata: {}, items: [] })
        transport.answerWith({ metadata: { remainingItemCount: 400 }, items: [pod('api-0', true)] })
        transport.answerWith({ metadata: {}, items: [] })
        transport.answerWith({ metadata: {}, items: [] })

        const overview = await service.load(request())

        expect(overview.workloads[1].total).toBe(401)
        expect(overview.workloads[1].healthy).toBe(401)
    })

    it('reports how many nodes are ready and names the ones that are not', async () => {
        transport.answerWith({ metadata: {}, items: [node('node-a', true), node('node-b', false), node('node-c', true, true)] })
        transport.answerWith({ metadata: {}, items: [] })
        transport.answerWith({ metadata: {}, items: [] })
        transport.answerWith({ metadata: {}, items: [] })

        const overview = await service.load(request())

        expect(overview.nodes).toMatchObject({ total: 3, ready: 2, error: '' })
        expect(overview.nodes.issues.map(issue => issue.name)).toEqual(['node-b', 'node-c'])
        expect(overview.nodes.issues[0].detail).toBe('Not ready')
        expect(overview.nodes.issues[1].detail).toBe('Cordoned')
    })

    it('asks the cluster for warnings rather than filtering every event here', async () => {
        transport.answerWith({ metadata: {}, items: [] })
        transport.answerWith({ metadata: {}, items: [] })
        transport.answerWith({ metadata: {}, items: [] })
        transport.answerWith({ metadata: {}, items: [warning('e-1', '2026-09-21T18:00:00Z')] })

        await service.load(request())

        expect(transport.path).toContain(`fieldSelector=${ClusterOverviewService.warningSelector}`)
    })

    it('shows the newest warnings first', async () => {
        transport.answerWith({ metadata: {}, items: [] })
        transport.answerWith({ metadata: {}, items: [] })
        transport.answerWith({ metadata: {}, items: [] })
        transport.answerWith({
            metadata: {},
            items: [
                warning('older', '2026-09-21T10:00:00Z'),
                warning('newer', '2026-09-21T18:00:00Z'),
            ],
        })

        const overview = await service.load(request())

        expect(overview.events.map(event => event.key)).toEqual(['newer', 'older'])
        expect(overview.events[0]).toMatchObject({ reason: 'BackOff', object: 'Pod: api-0', count: 4 })
    })

    it('shows no more warnings than the page has room for', async () => {
        const many = Array.from({ length: 40 }, (_, index) => warning(`e-${index}`, '2026-09-21T18:00:00Z'))
        transport.answerWith({ metadata: {}, items: [] })
        transport.answerWith({ metadata: {}, items: [] })
        transport.answerWith({ metadata: {}, items: [] })
        transport.answerWith({ metadata: {}, items: many })

        const overview = await service.load(request())

        expect(overview.events).toHaveLength(ClusterOverviewLimits.eventsShown)
    })

    it('keeps the rest of the overview when one kind cannot be read', async () => {
        transport.answerWith({ metadata: {}, items: [node('node-a', true)] })
        transport.failWith(new ApiError('The cluster denied access to this resource', 'Forbidden', 403))
        transport.answerWith({ metadata: {}, items: [] })
        transport.answerWith({ metadata: {}, items: [] })

        const overview = await service.load(request())

        expect(overview.workloads[1].error).toBe('The cluster denied access to this resource')
        expect(overview.nodes.total).toBe(1)
    })
})
