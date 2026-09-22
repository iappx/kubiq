import { describe, expect, it } from 'vitest'
import { PodContainerHealth, PodEntity } from '@/domain/entities/workloads'
import type { TPodSpec, TPodStatus } from '@/domain/entities/workloads'

const spec = (containers: string[], initContainers: string[] = []): TPodSpec => ({
    containers: containers.map(name => ({ name })),
    initContainers: initContainers.map(name => ({ name })),
})

describe('PodContainerHealth', () => {
    it('reports every container of a clean pod as healthy, in spec order', () => {
        const status: TPodStatus = {
            phase: 'Running',
            containerStatuses: [
                { name: 'sidecar', ready: true, state: { running: { startedAt: '2026-09-01T10:15:06Z' } } },
                { name: 'web', ready: true, state: { running: { startedAt: '2026-09-01T10:15:05Z' } } },
            ],
        }

        expect(PodContainerHealth.of(spec(['web', 'sidecar']), status)).toEqual([
            { name: 'web', isInit: false, state: 'ok', statusTitle: 'Running' },
            { name: 'sidecar', isInit: false, state: 'ok', statusTitle: 'Running' },
        ])
    })

    it('puts init containers first and marks them as such', () => {
        const status: TPodStatus = {
            phase: 'Pending',
            initContainerStatuses: [{ name: 'migrate', ready: false, state: { running: {} } }],
            containerStatuses: [{ name: 'web', ready: false, state: { waiting: { reason: 'PodInitializing' } } }],
        }

        expect(PodContainerHealth.of(spec(['web'], ['migrate']), status)).toEqual([
            { name: 'migrate', isInit: true, state: 'warning', statusTitle: 'Running (not ready)' },
            { name: 'web', isInit: false, state: 'warning', statusTitle: 'PodInitializing' },
        ])
    })

    it('reports a finished init container as healthy while the pod runs', () => {
        const status: TPodStatus = {
            phase: 'Running',
            initContainerStatuses: [
                { name: 'migrate', ready: true, state: { terminated: { reason: 'Completed', exitCode: 0 } } },
            ],
            containerStatuses: [{ name: 'web', ready: true, state: { running: {} } }],
        }

        expect(PodContainerHealth.of(spec(['web'], ['migrate']), status)).toEqual([
            { name: 'migrate', isInit: true, state: 'ok', statusTitle: 'Completed' },
            { name: 'web', isInit: false, state: 'ok', statusTitle: 'Running' },
        ])
    })

    it('reads a crash-looping container as an error and keeps the canonical reason', () => {
        const status: TPodStatus = {
            phase: 'Running',
            containerStatuses: [
                { name: 'web', ready: false, restartCount: 7, state: { waiting: { reason: 'CrashLoopBackOff' } } },
                { name: 'sidecar', ready: true, state: { running: {} } },
            ],
        }

        expect(PodContainerHealth.of(spec(['web', 'sidecar']), status)).toEqual([
            { name: 'web', isInit: false, state: 'error', statusTitle: 'CrashLoopBackOff' },
            { name: 'sidecar', isInit: false, state: 'ok', statusTitle: 'Running' },
        ])
    })

    it('reads a container that cannot pull its image as an error', () => {
        const status: TPodStatus = {
            phase: 'Pending',
            containerStatuses: [{ name: 'web', ready: false, state: { waiting: { reason: 'ImagePullBackOff' } } }],
        }

        expect(PodContainerHealth.of(spec(['web']), status)).toEqual([
            { name: 'web', isInit: false, state: 'error', statusTitle: 'ImagePullBackOff' },
        ])
    })

    it('treats a transient waiting reason as a warning rather than a fault', () => {
        const status: TPodStatus = {
            phase: 'Pending',
            containerStatuses: [{ name: 'web', ready: false, state: { waiting: { reason: 'ContainerCreating' } } }],
        }

        expect(PodContainerHealth.of(spec(['web']), status)).toEqual([
            { name: 'web', isInit: false, state: 'warning', statusTitle: 'ContainerCreating' },
        ])
    })

    it('names a waiting container that the cluster gave no reason for', () => {
        const status: TPodStatus = { containerStatuses: [{ name: 'web', ready: false, state: { waiting: {} } }] }

        expect(PodContainerHealth.of(spec(['web']), status)).toEqual([
            { name: 'web', isInit: false, state: 'warning', statusTitle: 'Waiting' },
        ])
    })

    it('warns about a running container that is not ready yet', () => {
        const status: TPodStatus = {
            phase: 'Running',
            containerStatuses: [{ name: 'web', ready: false, state: { running: {} } }],
        }

        expect(PodContainerHealth.of(spec(['web']), status)).toEqual([
            { name: 'web', isInit: false, state: 'warning', statusTitle: 'Running (not ready)' },
        ])
    })

    it('leaves a completed job pod clean rather than flagging its finished container', () => {
        const status: TPodStatus = {
            phase: 'Succeeded',
            containerStatuses: [
                {
                    name: 'import',
                    ready: false,
                    state: { terminated: { reason: 'Completed', exitCode: 0, finishedAt: '2026-09-01T10:20:00Z' } },
                },
            ],
        }

        expect(PodContainerHealth.of(spec(['import']), status)).toEqual([
            { name: 'import', isInit: false, state: 'ok', statusTitle: 'Completed' },
        ])
    })

    it('reads a non-zero exit as an error and says which code it was', () => {
        const status: TPodStatus = {
            phase: 'Failed',
            containerStatuses: [{ name: 'web', ready: false, state: { terminated: { reason: 'OOMKilled', exitCode: 137 } } }],
        }

        expect(PodContainerHealth.of(spec(['web']), status)).toEqual([
            { name: 'web', isInit: false, state: 'error', statusTitle: 'OOMKilled (exit 137)' },
        ])
    })

    it('names a terminated container the cluster gave no reason for', () => {
        const status: TPodStatus = {
            containerStatuses: [{ name: 'web', ready: false, state: { terminated: { exitCode: 2 } } }],
        }

        expect(PodContainerHealth.of(spec(['web']), status)).toEqual([
            { name: 'web', isInit: false, state: 'error', statusTitle: 'Terminated (exit 2)' },
        ])
    })

    it('still lists the containers of a pod the cluster has not reported on yet', () => {
        expect(PodContainerHealth.of(spec(['web', 'sidecar'], ['migrate']), { phase: 'Pending' })).toEqual([
            { name: 'migrate', isInit: true, state: 'unknown', statusTitle: 'Not started' },
            { name: 'web', isInit: false, state: 'unknown', statusTitle: 'Not started' },
            { name: 'sidecar', isInit: false, state: 'unknown', statusTitle: 'Not started' },
        ])
    })

    it('reports an empty state object as unknown instead of guessing', () => {
        expect(PodContainerHealth.of(spec(['web']), { containerStatuses: [{ name: 'web', state: {} }] })).toEqual([
            { name: 'web', isInit: false, state: 'unknown', statusTitle: 'Unknown' },
        ])
    })

    it('reports nothing for a pod with neither spec nor status', () => {
        expect(PodContainerHealth.of(undefined, undefined)).toEqual([])
    })

    it('ignores a status for a container the spec does not declare', () => {
        const status: TPodStatus = {
            containerStatuses: [
                { name: 'web', ready: true, state: { running: {} } },
                { name: 'gone', ready: true, state: { running: {} } },
            ],
        }

        expect(PodContainerHealth.of(spec(['web']), status)).toHaveLength(1)
    })
})

describe('PodEntity.containerHealth', () => {
    it('exposes the per-container health the table column reads', () => {
        const pod = PodEntity.build({
            uid: 'uid-1',
            metadata: { uid: 'uid-1', name: 'web-0', namespace: 'default' },
            spec: { containers: [{ name: 'web' }], initContainers: [{ name: 'migrate' }] },
            status: {
                phase: 'Running',
                initContainerStatuses: [{ name: 'migrate', state: { terminated: { reason: 'Completed', exitCode: 0 } } }],
                containerStatuses: [{ name: 'web', ready: false, state: { waiting: { reason: 'CrashLoopBackOff' } } }],
            },
        })

        expect(pod.containerHealth).toEqual([
            { name: 'migrate', isInit: true, state: 'ok', statusTitle: 'Completed' },
            { name: 'web', isInit: false, state: 'error', statusTitle: 'CrashLoopBackOff' },
        ])
    })

    it('reports nothing for a pod whose spec lists no containers', () => {
        const pod = PodEntity.build({ uid: 'uid-2', metadata: { uid: 'uid-2', name: 'web-1' } })

        expect(pod.containerHealth).toEqual([])
    })
})
