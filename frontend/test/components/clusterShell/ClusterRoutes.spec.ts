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

    it('encodes a context name that is an ARN', () => {
        const arn = 'arn:aws:eks:eu-west-1:123456789012:cluster/prod'

        expect(ClusterRoutes.shell(arn)).toBe('/cluster/arn%3Aaws%3Aeks%3Aeu-west-1%3A123456789012%3Acluster%2Fprod')
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
