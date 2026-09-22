import { describe, expect, it } from 'vitest'
import { PodSpecReader } from '@/domain/entities/workloads'

const containers = [{ name: 'api', image: 'ghcr.io/acme/api:1' }]

describe('PodSpecReader', () => {
    it('takes the spec of a pod as it stands', () => {
        expect(PodSpecReader.of({ kind: 'Pod', spec: { containers, nodeName: 'node-1' } }).nodeName).toBe('node-1')
    })

    it('reaches into the pod template of a Deployment', () => {
        const deployment = { kind: 'Deployment', spec: { replicas: 3, template: { spec: { containers } } } }

        expect(PodSpecReader.of(deployment).containers).toEqual(containers)
    })

    it('reaches into the pod template of a StatefulSet', () => {
        const statefulSet = { kind: 'StatefulSet', spec: { serviceName: 'api', template: { spec: { containers } } } }

        expect(PodSpecReader.of(statefulSet).containers).toEqual(containers)
    })

    it('reaches into the pod template of a DaemonSet', () => {
        expect(PodSpecReader.of({ kind: 'DaemonSet', spec: { template: { spec: { containers } } } }).containers)
            .toEqual(containers)
    })

    it('reaches into the pod template of a Job', () => {
        expect(PodSpecReader.of({ kind: 'Job', spec: { completions: 1, template: { spec: { containers } } } }).containers)
            .toEqual(containers)
    })

    it('reaches two levels down into the job template of a CronJob', () => {
        const cronJob = {
            kind: 'CronJob',
            spec: { schedule: '0 * * * *', jobTemplate: { spec: { template: { spec: { containers } } } } },
        }

        expect(PodSpecReader.of(cronJob).containers).toEqual(containers)
    })

    it('finds nothing in an object that carries no pod spec anywhere', () => {
        expect(PodSpecReader.of({ kind: 'Service', spec: { ports: [{ port: 80 }] } })).toEqual({})
        expect(PodSpecReader.of({ kind: 'Service' })).toEqual({})
    })
})
