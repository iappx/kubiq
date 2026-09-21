import { describe, expect, it } from 'vitest'
import { ServiceEntity } from '@/domain/entities/network'
import { KubeObjectFixtures } from '../support/fixtures/KubeObjectFixtures'

const build = (object: Record<string, any>): ServiceEntity => ServiceEntity.build(KubeObjectFixtures.withUid(object))

describe('ServiceEntity', () => {
    it('renders the ports as the table shows them', () => {
        expect(build(KubeObjectFixtures.loadBalancerService()).portsText).toBe('80:31580')
    })

    it('waits while a load balancer has no address yet', () => {
        const service = build(KubeObjectFixtures.loadBalancerService())

        expect(service.externalAddresses).toEqual([])
        expect(service.state).toBe('pending')
    })

    it('is healthy once the load balancer reports an address', () => {
        const source = KubeObjectFixtures.loadBalancerService()
        source.status.loadBalancer.ingress = [{ ip: '203.0.113.7' }]

        const service = build(source)

        expect(service.externalAddressText).toBe('203.0.113.7')
        expect(service.state).toBe('ok')
    })

    it('takes the hostname when the provider hands out a name instead of an ip', () => {
        const source = KubeObjectFixtures.loadBalancerService()
        source.status.loadBalancer.ingress = [{ hostname: 'lb.example.test' }]

        expect(build(source).externalAddressText).toBe('lb.example.test')
    })

    it('treats every other type as ready on arrival', () => {
        const source = KubeObjectFixtures.loadBalancerService()
        source.spec.type = 'ClusterIP'
        delete source.spec.ports[0].nodePort

        const service = build(source)

        expect(service.type).toBe('ClusterIP')
        expect(service.portsText).toBe('80')
        expect(service.state).toBe('ok')
    })

    it('defaults a missing type to ClusterIP, the way the API server does', () => {
        const source = KubeObjectFixtures.loadBalancerService()
        delete source.spec.type

        expect(build(source).type).toBe('ClusterIP')
    })
})
