import { describe, expect, it } from 'vitest'
import { ClusterRoutes } from '@/components/clusterShell/ClusterRoutes'
import { KubeResourceRegistry } from '@/domain/models/kube'

describe('ClusterRoutes', () => {
    it('addresses the shell of a cluster', () => {
        expect(ClusterRoutes.shell('prod')).toBe('/cluster/prod')
    })

    it('addresses a kind by its section and slug', () => {
        const kind = KubeResourceRegistry.find('apps', 'deployments')

        expect(ClusterRoutes.forKind('prod', kind!)).toBe('/cluster/prod/workloads/deployments.apps')
    })

    it('addresses the tool screens that sit beside the discovered kinds', () => {
        expect(ClusterRoutes.helm('prod')).toBe('/cluster/prod/helm')
        expect(ClusterRoutes.argocd('prod')).toBe('/cluster/prod/argocd')
    })

    it('encodes a context name that is an ARN', () => {
        const arn = 'arn:aws:eks:eu-west-1:123456789012:cluster/prod'

        expect(ClusterRoutes.shell(arn)).toBe('/cluster/arn%3Aaws%3Aeks%3Aeu-west-1%3A123456789012%3Acluster%2Fprod')
    })

    it('addresses one object inside a kind, with the tab it should open on', () => {
        const pods = KubeResourceRegistry.find('', 'pods')

        expect(ClusterRoutes.object('staging', pods!, { namespace: 'prod', name: 'api-7f9', tab: 'events' }))
            .toBe('/cluster/staging/workloads/pods?ns=prod&name=api-7f9&tab=events')
    })

    it('leaves the tab out when the object should open on its default', () => {
        const pods = KubeResourceRegistry.find('', 'pods')

        expect(ClusterRoutes.object('staging', pods!, { namespace: 'prod', name: 'api-7f9' }))
            .toBe('/cluster/staging/workloads/pods?ns=prod&name=api-7f9')
    })

    it('leaves the namespace out of a cluster-scoped object', () => {
        const nodes = KubeResourceRegistry.find('', 'nodes')

        expect(ClusterRoutes.object('staging', nodes!, { namespace: '', name: 'worker-1' }))
            .toContain('?name=worker-1')
    })

    it('encodes an object name that would otherwise break the query', () => {
        const pods = KubeResourceRegistry.find('', 'pods')

        expect(ClusterRoutes.object('staging', pods!, { namespace: 'a&b', name: 'c=d' }))
            .toBe('/cluster/staging/workloads/pods?ns=a%26b&name=c%3Dd')
    })

    it('addresses the list alone when no object is named', () => {
        const pods = KubeResourceRegistry.find('', 'pods')

        expect(ClusterRoutes.object('staging', pods!, { namespace: '', name: '' }))
            .toBe('/cluster/staging/workloads/pods')
    })

    it('recognises a cluster path', () => {
        expect(ClusterRoutes.isCluster('/cluster/prod/workloads/pods')).toBe(true)
        expect(ClusterRoutes.isCluster('/cluster')).toBe(true)
    })

    it('does not mistake the catalog for a cluster path', () => {
        expect(ClusterRoutes.isCluster(ClusterRoutes.catalog)).toBe(false)
        expect(ClusterRoutes.isCluster('/clusters/prod')).toBe(false)
    })
})
