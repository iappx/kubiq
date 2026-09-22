import { describe, expect, it } from 'vitest'
import { DetailConditions } from '@/components/resource/detail/DetailConditions'
import { DetailContainers } from '@/components/resource/detail/DetailContainers'
import { DetailFacts } from '@/components/resource/detail/DetailFacts'
import { DetailTabs } from '@/components/resource/detail/DetailTabs'
import { KubeResourceRegistry } from '@/domain/models/kube'

const pods = KubeResourceRegistry.find('', 'pods')!

const pod = {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: {
        name: 'api-0',
        namespace: 'payments',
        uid: 'p-1',
        resourceVersion: '4011',
        creationTimestamp: '2026-09-21T10:00:00Z',
        labels: { app: 'api' },
        annotations: { 'kubectl.kubernetes.io/restartedAt': '2026-09-21T09:00:00Z' },
    },
    spec: {
        nodeName: 'node-a',
        serviceAccountName: 'api',
        initContainers: [{ name: 'migrate', image: 'ghcr.io/acme/migrate:1' }],
        containers: [{ name: 'api', image: 'ghcr.io/acme/api:1.4.0' }],
    },
    status: {
        phase: 'Running',
        podIP: '10.1.2.3',
        conditions: [
            { type: 'Ready', status: 'True' },
            { type: 'ContainersReady', status: 'False', reason: 'ContainersNotReady', message: 'not yet' },
        ],
        initContainerStatuses: [{ name: 'migrate', ready: true, restartCount: 0, state: { terminated: { exitCode: 0, reason: 'Completed' } } }],
        containerStatuses: [{ name: 'api', ready: true, restartCount: 2, state: { running: {} } }],
    },
}

const labelOf = (label: string) => DetailFacts.of(pod, pods).find(fact => fact.label === label)?.value

describe('DetailFacts', () => {
    it('reads the identity of the object out of the manifest itself', () => {
        expect(labelOf('Kind')).toBe('Pod')
        expect(labelOf('API version')).toBe('v1')
        expect(labelOf('Name')).toBe('api-0')
        expect(labelOf('Namespace')).toBe('payments')
    })

    it('adds the fields a pod has and a controller does not', () => {
        expect(labelOf('Node')).toBe('node-a')
        expect(labelOf('Pod IP')).toBe('10.1.2.3')
        expect(labelOf('Phase')).toBe('Running')
    })

    it('leaves out a fact the object does not carry', () => {
        expect(DetailFacts.of({ metadata: { name: 'x' } }, null).map(fact => fact.label)).not.toContain('Node')
    })

    it('marks the creation timestamp so it renders as an age', () => {
        expect(DetailFacts.of(pod, pods).find(fact => fact.label === 'Created')?.isAge).toBe(true)
    })

    it('falls back to the kind when the document names neither', () => {
        expect(DetailFacts.of({ metadata: { name: 'x' } }, pods).find(fact => fact.label === 'Kind')?.value).toBe('Pod')
    })

    it('reads labels and annotations as plain pairs', () => {
        expect(DetailFacts.labelsOf(pod)).toEqual({ app: 'api' })
        expect(Object.keys(DetailFacts.annotationsOf(pod))).toHaveLength(1)
        expect(DetailFacts.labelsOf({})).toEqual({})
    })
})

describe('DetailConditions', () => {
    it('lists every condition the object reports', () => {
        expect(DetailConditions.of(pod).map(condition => condition.type)).toEqual(['Ready', 'ContainersReady'])
    })

    it('marks a condition by whether it holds, not by whether it is good news', () => {
        const conditions = DetailConditions.of(pod)

        expect(conditions[0].tone).toBe('info')
        expect(conditions[1].tone).toBe('pending')
        expect(DetailConditions.toneOf('Unknown')).toBe('unknown')
    })

    it('carries the reason and message for the row to show', () => {
        expect(DetailConditions.of(pod)[1]).toMatchObject({ reason: 'ContainersNotReady', message: 'not yet' })
    })

    it('finds none on an object with no status', () => {
        expect(DetailConditions.of({})).toEqual([])
    })
})

describe('DetailContainers', () => {
    it('lists init containers before the ordinary ones', () => {
        expect(DetailContainers.of(pod).map(container => container.name)).toEqual(['migrate', 'api'])
    })

    it('pairs each container with the status of the same name', () => {
        const api = DetailContainers.of(pod).find(container => container.name === 'api')

        expect(api).toMatchObject({ state: 'Running', tone: 'ok', restarts: 2 })
    })

    it('reads a clean exit as done rather than as a failure', () => {
        expect(DetailContainers.of(pod)[0]).toMatchObject({ state: 'Completed', tone: 'ok' })
    })

    it('reads a waiting container as a warning and keeps its reason', () => {
        const waiting = {
            spec: { containers: [{ name: 'api', image: 'x' }] },
            status: { containerStatuses: [{ name: 'api', state: { waiting: { reason: 'CrashLoopBackOff', message: 'back-off' } } }] },
        }

        expect(DetailContainers.of(waiting)[0]).toMatchObject({ state: 'CrashLoopBackOff', tone: 'warning', detail: 'back-off' })
    })

    it('reads a non-zero exit as an error and names the code', () => {
        const failed = {
            spec: { containers: [{ name: 'api', image: 'x' }] },
            status: { containerStatuses: [{ name: 'api', state: { terminated: { exitCode: 137, reason: 'OOMKilled' } } }] },
        }

        expect(DetailContainers.of(failed)[0]).toMatchObject({ state: 'OOMKilled', tone: 'error', detail: 'Exit code 137' })
    })

    it('finds the containers of a Deployment in its pod template', () => {
        const deployment = { spec: { template: { spec: { containers: [{ name: 'api', image: 'ghcr.io/acme/api:1' }] } } } }

        expect(DetailContainers.of(deployment)).toMatchObject([{ name: 'api', state: 'Not started' }])
    })

    it('finds the containers of a CronJob two levels down', () => {
        const cronJob = { spec: { jobTemplate: { spec: { template: { spec: { containers: [{ name: 'report', image: 'x' }] } } } } } }

        expect(DetailContainers.of(cronJob).map(container => container.name)).toEqual(['report'])
    })

    it('finds none on an object that has no containers at all', () => {
        expect(DetailContainers.of({ spec: {} })).toEqual([])
    })
})

describe('DetailTabs', () => {
    it('discloses the object in the order the brief fixes', () => {
        expect(DetailTabs.of(pods).map(tab => tab.key))
            .toEqual(['overview', 'environment', 'details', 'metadata', 'events', 'yaml'])
    })

    it('gives the facts a tab of their own whether or not the kind can be charted', () => {
        const secrets = KubeResourceRegistry.find('', 'secrets')!

        expect(DetailTabs.hasMetrics(secrets)).toBe(false)
        expect(DetailTabs.of(secrets).map(tab => tab.key))
            .toEqual(['overview', 'data', 'details', 'metadata', 'events', 'yaml'])
    })

    it('answers whether a tab is there', () => {
        expect(DetailTabs.has(DetailTabs.of(pods), DetailTabs.yamlKey)).toBe(true)
    })
})
