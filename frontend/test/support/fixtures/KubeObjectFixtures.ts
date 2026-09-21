// Shaped like the objects the API server returns. Every builder hands back a
// fresh deep copy so a test that mutates one cannot leak into the next.
export class KubeObjectFixtures {
    // What the query layer of T-0005 does to every item before building an
    // entity: the primary key has to be flat, and metadata.uid is where it lives.
    public static withUid<T extends { metadata?: { uid?: string } }>(object: T): T & { uid: string } {
        return { ...object, uid: object.metadata?.uid ?? '' }
    }

    public static runningPod(): Record<string, any> {
        return {
            apiVersion: 'v1',
            kind: 'Pod',
            metadata: {
                name: 'web-5d9f7c8b6-abcde',
                namespace: 'default',
                uid: '0f1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9',
                resourceVersion: '182736',
                creationTimestamp: '2026-09-01T10:15:00Z',
                labels: { app: 'web', 'pod-template-hash': '5d9f7c8b6' },
                ownerReferences: [
                    {
                        apiVersion: 'apps/v1',
                        kind: 'ReplicaSet',
                        name: 'web-5d9f7c8b6',
                        uid: 'aaaa1111-bbbb-2222-cccc-333344445555',
                        controller: true,
                        blockOwnerDeletion: true,
                    },
                ],
            },
            spec: {
                nodeName: 'worker-1',
                serviceAccountName: 'default',
                restartPolicy: 'Always',
                containers: [
                    { name: 'web', image: 'nginx:1.27', ports: [{ containerPort: 80, protocol: 'TCP' }] },
                    { name: 'sidecar', image: 'busybox:1.36' },
                ],
            },
            status: {
                phase: 'Running',
                podIP: '10.244.1.17',
                hostIP: '192.168.1.11',
                qosClass: 'Burstable',
                startTime: '2026-09-01T10:15:02Z',
                conditions: [{ type: 'Ready', status: 'True' }],
                containerStatuses: [
                    { name: 'web', ready: true, restartCount: 0, state: { running: { startedAt: '2026-09-01T10:15:05Z' } } },
                    { name: 'sidecar', ready: true, restartCount: 2, state: { running: { startedAt: '2026-09-01T10:15:06Z' } } },
                ],
            },
        }
    }

    public static crashLoopPod(): Record<string, any> {
        const pod = KubeObjectFixtures.runningPod()
        pod.metadata.name = 'worker-6c4b9d7f5-zzzzz'
        pod.metadata.uid = '11112222-3333-4444-5555-666677778888'
        pod.status.containerStatuses[0] = {
            name: 'web',
            ready: false,
            restartCount: 7,
            state: { waiting: { reason: 'CrashLoopBackOff', message: 'back-off 5m0s restarting failed container' } },
        }
        pod.status.conditions = [{ type: 'Ready', status: 'False', reason: 'ContainersNotReady' }]
        return pod
    }

    public static pendingPod(): Record<string, any> {
        const pod = KubeObjectFixtures.runningPod()
        pod.metadata.name = 'queue-0'
        pod.metadata.uid = '99998888-7777-6666-5555-444433332222'
        delete pod.spec.nodeName
        pod.status = {
            phase: 'Pending',
            conditions: [{ type: 'PodScheduled', status: 'False', reason: 'Unschedulable' }],
            containerStatuses: [
                { name: 'web', ready: false, restartCount: 0, state: { waiting: { reason: 'ContainerCreating' } } },
                { name: 'sidecar', ready: false, restartCount: 0, state: { waiting: { reason: 'ContainerCreating' } } },
            ],
        }
        return pod
    }

    public static degradedPod(): Record<string, any> {
        const pod = KubeObjectFixtures.runningPod()
        pod.metadata.name = 'web-5d9f7c8b6-fghij'
        pod.metadata.uid = 'abcdabcd-1234-1234-1234-abcdabcdabcd'
        pod.status.containerStatuses[1].ready = false
        return pod
    }

    public static deployment(): Record<string, any> {
        return {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            metadata: {
                name: 'web',
                namespace: 'default',
                uid: 'dddd1111-2222-3333-4444-555566667777',
                generation: 4,
                creationTimestamp: '2026-08-20T09:00:00Z',
                labels: { app: 'web' },
            },
            spec: {
                replicas: 3,
                selector: { matchLabels: { app: 'web' } },
                strategy: { type: 'RollingUpdate' },
            },
            status: {
                replicas: 3,
                readyReplicas: 3,
                availableReplicas: 3,
                updatedReplicas: 3,
                observedGeneration: 4,
                conditions: [
                    { type: 'Available', status: 'True', reason: 'MinimumReplicasAvailable' },
                    { type: 'Progressing', status: 'True', reason: 'NewReplicaSetAvailable' },
                ],
            },
        }
    }

    public static node(): Record<string, any> {
        return {
            apiVersion: 'v1',
            kind: 'Node',
            metadata: {
                name: 'worker-1',
                uid: 'nnnn1111-2222-3333-4444-555566667777',
                creationTimestamp: '2026-06-01T08:00:00Z',
                labels: {
                    'kubernetes.io/hostname': 'worker-1',
                    'kubernetes.io/os': 'linux',
                    'node-role.kubernetes.io/worker': '',
                },
            },
            spec: { podCIDR: '10.244.1.0/24' },
            status: {
                capacity: { cpu: '4', memory: '8153316Ki', pods: '110' },
                allocatable: { cpu: '3800m', memory: '7530916Ki', pods: '110' },
                conditions: [
                    { type: 'MemoryPressure', status: 'False', reason: 'KubeletHasSufficientMemory' },
                    { type: 'DiskPressure', status: 'False', reason: 'KubeletHasNoDiskPressure' },
                    { type: 'PIDPressure', status: 'False', reason: 'KubeletHasSufficientPID' },
                    { type: 'Ready', status: 'True', reason: 'KubeletReady' },
                ],
                addresses: [
                    { type: 'InternalIP', address: '192.168.1.11' },
                    { type: 'Hostname', address: 'worker-1' },
                ],
                nodeInfo: {
                    architecture: 'amd64',
                    operatingSystem: 'linux',
                    osImage: 'Ubuntu 24.04.1 LTS',
                    kernelVersion: '6.8.0-45-generic',
                    kubeletVersion: 'v1.31.1',
                    containerRuntimeVersion: 'containerd://1.7.22',
                },
            },
        }
    }

    public static warningEvent(): Record<string, any> {
        return {
            apiVersion: 'v1',
            kind: 'Event',
            metadata: {
                name: 'queue-0.1864f2c3d4e5f607',
                namespace: 'default',
                uid: 'eeee1111-2222-3333-4444-555566667777',
                creationTimestamp: '2026-09-01T10:16:00Z',
            },
            involvedObject: {
                kind: 'Pod',
                name: 'queue-0',
                namespace: 'default',
                uid: '99998888-7777-6666-5555-444433332222',
            },
            reason: 'FailedScheduling',
            message: '0/3 nodes are available: 3 Insufficient cpu.',
            source: { component: 'default-scheduler' },
            type: 'Warning',
            count: 12,
            firstTimestamp: '2026-09-01T10:15:10Z',
            lastTimestamp: '2026-09-01T10:16:40Z',
        }
    }

    public static loadBalancerService(): Record<string, any> {
        return {
            apiVersion: 'v1',
            kind: 'Service',
            metadata: {
                name: 'web',
                namespace: 'default',
                uid: 'ssss1111-2222-3333-4444-555566667777',
                creationTimestamp: '2026-08-20T09:00:00Z',
            },
            spec: {
                type: 'LoadBalancer',
                clusterIP: '10.96.14.2',
                selector: { app: 'web' },
                ports: [{ name: 'http', port: 80, targetPort: 8080, nodePort: 31580, protocol: 'TCP' }],
            },
            status: { loadBalancer: {} },
        }
    }

    public static boundPersistentVolumeClaim(): Record<string, any> {
        return {
            apiVersion: 'v1',
            kind: 'PersistentVolumeClaim',
            metadata: {
                name: 'data-queue-0',
                namespace: 'default',
                uid: 'pppp1111-2222-3333-4444-555566667777',
                creationTimestamp: '2026-08-20T09:00:00Z',
            },
            spec: {
                accessModes: ['ReadWriteOnce'],
                storageClassName: 'standard',
                volumeName: 'pvc-11112222-3333',
                resources: { requests: { storage: '10Gi' } },
            },
            status: {
                phase: 'Bound',
                accessModes: ['ReadWriteOnce'],
                capacity: { storage: '10Gi' },
            },
        }
    }

    public static customResource(): Record<string, any> {
        return {
            apiVersion: 'cert-manager.io/v1',
            kind: 'Certificate',
            metadata: {
                name: 'web-tls',
                namespace: 'default',
                uid: 'cccc1111-2222-3333-4444-555566667777',
                creationTimestamp: '2026-08-25T12:00:00Z',
            },
            spec: {
                secretName: 'web-tls',
                dnsNames: ['example.test'],
                issuerRef: { name: 'letsencrypt', kind: 'ClusterIssuer' },
            },
            status: {
                conditions: [{ type: 'Ready', status: 'True', reason: 'Ready' }],
                notAfter: '2026-11-23T12:00:00Z',
            },
        }
    }
}
