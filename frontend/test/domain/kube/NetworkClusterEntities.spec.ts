import { describe, expect, it } from 'vitest'
import { CustomResourceDefinitionEntity, NodeDrainPolicy } from '@/domain/entities/cluster'
import { EndpointsEntity, IngressClassEntity, NetworkPolicyEntity } from '@/domain/entities/network'
import { PodEntity } from '@/domain/entities/workloads'

describe('EndpointsEntity', () => {
    const endpoints = (subsets: unknown[]) => EndpointsEntity.build({
        uid: 'ep-uid',
        metadata: { uid: 'ep-uid', name: 'api', namespace: 'payments' },
        subsets,
    })

    it('pairs every address with every port it serves', () => {
        const entity = endpoints([{ addresses: [{ ip: '10.0.0.1' }], ports: [{ port: 80 }, { port: 443 }] }])

        expect(entity.endpointsText).toBe('10.0.0.1:80, 10.0.0.1:443')
        expect(entity.readyCount).toBe(1)
        expect(entity.state).toBe('ok')
    })

    it('counts the overflow rather than printing a hundred addresses', () => {
        const addresses = ['10.0.0.1', '10.0.0.2', '10.0.0.3', '10.0.0.4'].map(ip => ({ ip }))
        const entity = endpoints([{ addresses, ports: [] }])

        expect(entity.endpointsText).toBe('10.0.0.1, 10.0.0.2, 10.0.0.3 +1')
    })

    it('reads a mix of ready and not-ready addresses as degraded', () => {
        const entity = endpoints([{ addresses: [{ ip: '10.0.0.1' }], notReadyAddresses: [{ ip: '10.0.0.2' }] }])

        expect(entity.state).toBe('warning')
        expect(entity.notReadyAddresses).toEqual(['10.0.0.2'])
    })

    it('is an error with nothing ready and something failing, pending with nothing at all', () => {
        expect(endpoints([{ notReadyAddresses: [{ ip: '10.0.0.2' }] }]).state).toBe('error')
        expect(endpoints([]).state).toBe('pending')
    })
})

describe('IngressClassEntity', () => {
    it('reads the controller and the default marker', () => {
        const entity = IngressClassEntity.build({
            uid: 'ic-uid',
            metadata: {
                uid: 'ic-uid',
                name: 'nginx',
                annotations: { 'ingressclass.kubernetes.io/is-default-class': 'true' },
            },
            spec: { controller: 'k8s.io/ingress-nginx' },
        })

        expect(entity.controller).toBe('k8s.io/ingress-nginx')
        expect(entity.isDefault).toBe(true)
    })

    it('is not default without the annotation', () => {
        const entity = IngressClassEntity.build({
            uid: 'ic-uid',
            metadata: { uid: 'ic-uid', name: 'traefik' },
            spec: {},
        })

        expect(entity.isDefault).toBe(false)
        expect(entity.controller).toBe('')
    })
})

describe('NetworkPolicyEntity', () => {
    it('reads an empty pod selector as every pod, not as none', () => {
        const entity = NetworkPolicyEntity.build({
            uid: 'np-uid',
            metadata: { uid: 'np-uid', name: 'deny-all', namespace: 'payments' },
            spec: { podSelector: {}, policyTypes: ['Ingress', 'Egress'] },
        })

        expect(entity.podSelectorText).toBe(NetworkPolicyEntity.allPodsText)
        expect(entity.policyTypesText).toBe('Ingress, Egress')
        expect(entity.ruleCount).toBe(0)
    })

    it('renders match labels and counts expressions', () => {
        const entity = NetworkPolicyEntity.build({
            uid: 'np-uid',
            metadata: { uid: 'np-uid', name: 'api', namespace: 'payments' },
            spec: {
                podSelector: { matchLabels: { app: 'api' }, matchExpressions: [{ key: 'tier', operator: 'Exists' }] },
                ingress: [{}],
                egress: [{}, {}],
            },
        })

        expect(entity.podSelectorText).toBe('app=api, 1 expressions')
        expect(entity.ruleCount).toBe(3)
    })
})

describe('CustomResourceDefinitionEntity', () => {
    const crd = (conditions: unknown[] | undefined) => CustomResourceDefinitionEntity.build({
        uid: 'crd-uid',
        metadata: { uid: 'crd-uid', name: 'widgets.example.test' },
        spec: {
            group: 'example.test',
            scope: 'Namespaced',
            names: { plural: 'widgets', kind: 'Widget' },
            versions: [
                { name: 'v1alpha1', served: true, storage: false },
                { name: 'v1', served: true, storage: true },
                { name: 'v1beta1', served: false, storage: false },
            ],
        },
        status: { conditions },
    })

    it('lists only the versions the cluster serves and names the stored one', () => {
        const entity = crd([{ type: 'Established', status: 'True' }])

        expect(entity.group).toBe('example.test')
        expect(entity.resource).toBe('widgets')
        expect(entity.definedKind).toBe('Widget')
        expect(entity.scope).toBe('Namespaced')
        expect(entity.servedVersionsText).toBe('v1alpha1, v1')
        expect(entity.storedVersion).toBe('v1')
        expect(entity.state).toBe('ok')
    })

    it('is an error when the names were refused and unknown before it is judged', () => {
        expect(crd(undefined).state).toBe('unknown')
        expect(crd([
            { type: 'Established', status: 'False' },
            { type: 'NamesAccepted', status: 'False' },
        ]).state).toBe('error')
        expect(crd([{ type: 'Established', status: 'False' }]).state).toBe('pending')
    })
})

describe('NodeDrainPolicy', () => {
    const pod = (data: Record<string, unknown>) => PodEntity.build({
        uid: 'pod-uid',
        metadata: { uid: 'pod-uid', name: 'web', namespace: 'dev', ...(data.metadata as object ?? {}) },
        spec: { nodeName: 'worker-1' },
        status: { phase: data.phase ?? 'Running' },
    })

    it('evicts an ordinary running pod', () => {
        expect(NodeDrainPolicy.verdictFor(pod({})).evict).toBe(true)
    })

    it('leaves a mirror pod in place', () => {
        const mirror = pod({ metadata: { annotations: { 'kubernetes.io/config.mirror': 'abc' } } })

        expect(NodeDrainPolicy.verdictFor(mirror).evict).toBe(false)
        expect(NodeDrainPolicy.verdictFor(mirror).reason).toContain('Mirror')
    })

    it('leaves a DaemonSet pod in place, because it comes straight back', () => {
        const owned = pod({ metadata: { ownerReferences: [{ kind: 'DaemonSet', name: 'fluentd', uid: 'ds-uid' }] } })

        expect(NodeDrainPolicy.verdictFor(owned).evict).toBe(false)
    })

    it('leaves a finished pod in place', () => {
        expect(NodeDrainPolicy.verdictFor(pod({ phase: 'Succeeded' })).evict).toBe(false)
        expect(NodeDrainPolicy.verdictFor(pod({ phase: 'Failed' })).evict).toBe(false)
    })

    it('splits a list into what goes and what stays', () => {
        const pods = [
            pod({}),
            pod({ phase: 'Succeeded' }),
            pod({ metadata: { ownerReferences: [{ kind: 'ReplicaSet', name: 'web', uid: 'rs-uid' }] } }),
        ]

        expect(NodeDrainPolicy.evictable(pods)).toHaveLength(2)
        expect(NodeDrainPolicy.skipped(pods)).toHaveLength(1)
    })
})
