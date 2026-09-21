import { describe, expect, it } from 'vitest'
import { ObjectMetaEntity } from '@/domain/entities/kube'
import { PodEntity } from '@/domain/entities/workloads'
import { KubeObjectFixtures } from '../support/fixtures/KubeObjectFixtures'

const build = (object: Record<string, any>): PodEntity => PodEntity.build(KubeObjectFixtures.withUid(object))

describe('PodEntity', () => {
    it('takes its primary key from the flat uid the query layer adds', () => {
        const pod = build(KubeObjectFixtures.runningPod())

        expect(pod.uid).toBe('0f1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9')
        expect(pod.getPkValue()).toBe(pod.uid)
    })

    it('keeps the synthetic uid out of the manifest but leaves the rest intact', () => {
        const source = KubeObjectFixtures.runningPod()
        const serialized = build(source).serialize()

        expect(serialized.uid).toBeUndefined()
        expect(serialized.apiVersion).toBe('v1')
        expect(serialized.kind).toBe('Pod')
        expect(serialized.metadata.uid).toBe(source.metadata.uid)
        expect(serialized.spec).toEqual(source.spec)
        expect(serialized.status).toEqual(source.status)
    })

    it('carries spec and status through untouched, beyond what the types name', () => {
        const source = KubeObjectFixtures.runningPod()
        source.spec.tolerations = [{ key: 'node.kubernetes.io/not-ready', operator: 'Exists' }]

        expect(build(source).serialize().spec.tolerations).toHaveLength(1)
    })

    it('builds metadata as a nested entity', () => {
        expect(build(KubeObjectFixtures.runningPod()).metadata).toBeInstanceOf(ObjectMetaEntity)
    })

    it('exposes the column values the registry names', () => {
        const pod = build(KubeObjectFixtures.runningPod())

        expect(pod.name).toBe('web-5d9f7c8b6-abcde')
        expect(pod.namespace).toBe('default')
        expect(pod.nodeName).toBe('worker-1')
        expect(pod.podIp).toBe('10.244.1.17')
        expect(pod.readyText).toBe('2/2')
        expect(pod.restartCount).toBe(2)
        expect(pod.createdAt).toBe('2026-09-01T10:15:00Z')
    })

    it('counts restarts across init containers too', () => {
        const source = KubeObjectFixtures.runningPod()
        source.status.initContainerStatuses = [{ name: 'init', ready: true, restartCount: 3 }]

        expect(build(source).restartCount).toBe(5)
    })

    it('is healthy when every container of a running pod is ready', () => {
        const pod = build(KubeObjectFixtures.runningPod())

        expect(pod.state).toBe('ok')
        expect(pod.isProblematic).toBe(false)
    })

    it('is a warning when a running pod has a container that is not ready', () => {
        const pod = build(KubeObjectFixtures.degradedPod())

        expect(pod.readyText).toBe('1/2')
        expect(pod.state).toBe('warning')
        expect(pod.isProblematic).toBe(true)
    })

    it('is an error while a container sits in a failing waiting reason', () => {
        const pod = build(KubeObjectFixtures.crashLoopPod())

        expect(pod.state).toBe('error')
        expect(pod.reason).toBe('CrashLoopBackOff')
        expect(pod.failingContainers).toHaveLength(1)
        expect(pod.isProblematic).toBe(true)
    })

    it('treats a transient waiting reason as pending rather than as a fault', () => {
        const pod = build(KubeObjectFixtures.pendingPod())

        expect(pod.phase).toBe('Pending')
        expect(pod.failingContainers).toEqual([])
        expect(pod.state).toBe('pending')
        expect(pod.isProblematic).toBe(false)
    })

    it('reads a failed phase as an error and a succeeded one as done', () => {
        const failed = KubeObjectFixtures.runningPod()
        failed.status.phase = 'Failed'
        const succeeded = KubeObjectFixtures.runningPod()
        succeeded.status.phase = 'Succeeded'

        expect(build(failed).state).toBe('error')
        expect(build(succeeded).state).toBe('ok')
    })

    it('is an error when a container terminated with a non-zero exit code', () => {
        const source = KubeObjectFixtures.runningPod()
        source.status.containerStatuses[0].state = { terminated: { reason: 'Error', exitCode: 137 } }

        expect(build(source).state).toBe('error')
    })

    it('does not flag a container that terminated cleanly', () => {
        const source = KubeObjectFixtures.runningPod()
        source.status.phase = 'Succeeded'
        source.status.containerStatuses[0].state = { terminated: { reason: 'Completed', exitCode: 0 } }

        expect(build(source).failingContainers).toEqual([])
    })

    it('reads as pending while it is being deleted, whatever the phase says', () => {
        const source = KubeObjectFixtures.crashLoopPod()
        source.metadata.deletionTimestamp = '2026-09-01T10:20:00Z'

        expect(build(source).state).toBe('pending')
    })

    it('falls back to unknown when the cluster reports no phase', () => {
        const source = KubeObjectFixtures.runningPod()
        delete source.status.phase

        expect(build(source).state).toBe('unknown')
    })
})
