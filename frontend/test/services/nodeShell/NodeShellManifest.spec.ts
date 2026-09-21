import { describe, expect, it } from 'vitest'
import { NodeShellDefaults } from '@/application/services/nodeShell/constants/NodeShellDefaults'
import { NodeShellManifest } from '@/application/services/nodeShell/models/NodeShellManifest'

const pod = {
    name: 'node-shell-worker-1-abc123',
    namespace: 'kube-system',
    nodeName: 'worker-1',
    image: 'docker.io/library/alpine:3.20',
}

const spec = (): Record<string, any> => NodeShellManifest.document(pod).spec as Record<string, any>

describe('NodeShellManifest', () => {
    describe('the pod name', () => {
        it('is built from the node and a token', () => {
            expect(NodeShellManifest.nameFor('worker-1', 'abc123def')).toBe('node-shell-worker-1-abc123')
        })

        it('turns a node name that is not a DNS label into one', () => {
            expect(NodeShellManifest.nameFor('ip-10.0.1.5.eu-west-1.compute.internal', 'aa11bb'))
                .toBe('node-shell-ip-10-0-1-5-eu-west-1-compute-internal-aa11bb')
        })

        it('stays inside the length a pod name allows', () => {
            const name = NodeShellManifest.nameFor('a'.repeat(200), 'abcdef')

            expect(name.length).toBeLessThanOrEqual(NodeShellDefaults.maxNameLength)
        })
    })

    it('labels the pod so a later run can find it again', () => {
        const labels = NodeShellManifest.labels('worker-1')

        expect(labels[NodeShellDefaults.managedByLabel]).toBe('kubiq')
        expect(labels[NodeShellDefaults.componentLabel]).toBe('node-shell')
        expect(labels[NodeShellDefaults.nodeLabel]).toBe('worker-1')
        expect(NodeShellManifest.selector()).toBe('app.kubernetes.io/managed-by=kubiq,kubiq.dev/component=node-shell')
    })

    it('pins the pod to the node it is a shell for', () => {
        expect(spec().nodeName).toBe('worker-1')
        expect(spec().tolerations).toEqual([{ operator: 'Exists' }])
    })

    // nsenter needs the host pid namespace and privileges, or the shell is useless.
    it('runs privileged in the host namespaces', () => {
        expect(spec().hostPID).toBe(true)
        expect(spec().containers[0].securityContext).toEqual({ privileged: true })
        expect(spec().containers[0].command[0]).toBe('nsenter')
    })

    // stdinOnce is what makes a crashed application stop leaving a live shell behind.
    it('ends the shell when the attach goes away', () => {
        const container = spec().containers[0]

        expect(container.stdin).toBe(true)
        expect(container.stdinOnce).toBe(true)
        expect(container.tty).toBe(true)
        expect(spec().restartPolicy).toBe('Never')
        expect(spec().activeDeadlineSeconds).toBe(NodeShellDefaults.deadlineSeconds)
    })

    it('takes the image it was handed rather than deciding one', () => {
        expect(spec().containers[0].image).toBe('docker.io/library/alpine:3.20')
        expect(NodeShellManifest.document({ ...pod, image: 'registry.internal/alpine:3.20' }).spec)
            .toMatchObject({ containers: [{ image: 'registry.internal/alpine:3.20' }] })
    })

    it('is a Pod the API server will accept', () => {
        const document = NodeShellManifest.document(pod)

        expect(document.apiVersion).toBe('v1')
        expect(document.kind).toBe('Pod')
        expect(document.metadata).toMatchObject({ name: pod.name, namespace: 'kube-system' })
    })
})
