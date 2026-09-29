import { describe, expect, it } from 'vitest'
import { DetailPorts } from '@/components/resource/detail/DetailPorts'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import { KubeResourceRegistry } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'

const kind = (group: string, resource: string): KubeResourceKind => KubeResourceRegistry.find(group, resource)!

const pods = kind('', 'pods')
const services = kind('', 'services')
const deployments = kind('apps', 'deployments')

const pod = {
    kind: 'Pod',
    spec: {
        initContainers: [{ name: 'migrate', ports: [{ containerPort: 5432, name: 'pg' }] }],
        containers: [
            {
                name: 'app',
                ports: [
                    { containerPort: 8080, name: 'http', protocol: 'TCP' },
                    { containerPort: 8080, name: 'http', protocol: 'TCP' },
                    { containerPort: 53, protocol: 'udp' },
                    { containerPort: 0 },
                    'garbage',
                ],
            },
            { name: 'sidecar', ports: [{ containerPort: 9090, name: 'metrics' }] },
            { name: 'bare' },
        ],
    },
}

const service = {
    kind: 'Service',
    spec: {
        ports: [
            { name: 'http', port: 80, targetPort: 'http', protocol: 'TCP', nodePort: 30080 },
            { port: 9090 },
            { name: 'dns', port: 53, targetPort: 5353, protocol: 'UDP' },
            { name: 'broken' },
        ],
    },
}

const forward = (overrides: Partial<TPortForward> = {}): TPortForward => ({
    id: 'pf-1',
    clusterId: 'prod',
    namespace: 'payments',
    resource: 'services',
    name: 'api',
    remotePort: 80,
    localPort: 0,
    lastLocalPort: 0,
    restoreMode: 'onConnect',
    isStoppedByUser: false,
    createdAt: 1,
    label: 'svc/api:80',
    status: 'active',
    error: '',
    boundPort: 40001,
    podName: 'api-0',
    targetPort: 8080,
    ...overrides,
})

describe('DetailPorts', () => {
    it('is shown on pods and services only', () => {
        expect(DetailPorts.isShown(pods)).toBe(true)
        expect(DetailPorts.isShown(services)).toBe(true)
        expect(DetailPorts.isShown(deployments)).toBe(false)
        expect(DetailPorts.of(pod, deployments)).toEqual([])
    })

    it('lists the ports of a pod per container, init containers first, without repeats', () => {
        const rows = DetailPorts.of(pod, pods)

        expect(rows.map(row => `${row.container}:${row.port}/${row.protocol}`))
            .toEqual(['migrate:5432/TCP', 'app:8080/TCP', 'app:53/UDP', 'sidecar:9090/TCP'])
        expect(rows[1]).toMatchObject({ name: 'http', targetPort: '', nodePort: 0, forwardable: true })
    })

    it('says which declared ports cannot be forwarded', () => {
        const rows = DetailPorts.of(pod, pods)

        expect(rows.filter(row => !row.forwardable).map(row => row.port)).toEqual([53])
    })

    it('lists the ports of a service with their target and node port', () => {
        const rows = DetailPorts.of(service, services)

        expect(rows).toEqual([
            {
                key: '/80/TCP', port: 80, name: 'http', protocol: 'TCP', forwardable: true,
                container: '', targetPort: 'http', nodePort: 30080,
            },
            {
                key: '/9090/TCP', port: 9090, name: '', protocol: 'TCP', forwardable: true,
                container: '', targetPort: '9090', nodePort: 0,
            },
            {
                key: '/53/UDP', port: 53, name: 'dns', protocol: 'UDP', forwardable: false,
                container: '', targetPort: '5353', nodePort: 0,
            },
        ])
    })

    it('reads nothing from an object that carries no ports', () => {
        expect(DetailPorts.of({}, pods)).toEqual([])
        expect(DetailPorts.of({ spec: { ports: 'none' } }, services)).toEqual([])
    })

    it('ties a service forward to the pod port it lands on', () => {
        const rows = DetailPorts.of(pod, pods)
        const through = [forward(), forward({ id: 'pf-2', targetPort: 7000 })]

        expect(DetailPorts.via(through, rows[1]).map(open => open.id)).toEqual(['pf-1'])
        expect(DetailPorts.unmatched(through, rows).map(open => open.id)).toEqual(['pf-2'])
    })

    it('gives every forward status a tone', () => {
        expect(DetailPorts.toneOf('active')).toBe('ok')
        expect(DetailPorts.toneOf('starting')).toBe('pending')
        expect(DetailPorts.toneOf('waiting')).toBe('pending')
        expect(DetailPorts.toneOf('reconnecting')).toBe('warning')
        expect(DetailPorts.toneOf('error')).toBe('error')
        expect(DetailPorts.toneOf('stopped')).toBe('unknown')
    })
})
