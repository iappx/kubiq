import { describe, expect, it } from 'vitest'
import { KubeResourceRegistry, KubeWorkloadCatalog } from '@/domain/models/kube'

const kind = (group: string, resource: string) => KubeResourceRegistry.find(group, resource)!

describe('KubeWorkloadCatalog', () => {
    it('knows what has a replica count to set', () => {
        expect(KubeWorkloadCatalog.canScale(kind('apps', 'deployments'))).toBe(true)
        expect(KubeWorkloadCatalog.canScale(kind('apps', 'statefulsets'))).toBe(true)
        expect(KubeWorkloadCatalog.canScale(kind('apps', 'replicasets'))).toBe(true)
        expect(KubeWorkloadCatalog.canScale(kind('', 'replicationcontrollers'))).toBe(true)
    })

    it('knows what has none', () => {
        expect(KubeWorkloadCatalog.canScale(kind('apps', 'daemonsets'))).toBe(false)
        expect(KubeWorkloadCatalog.canScale(kind('batch', 'jobs'))).toBe(false)
        expect(KubeWorkloadCatalog.canScale(kind('', 'pods'))).toBe(false)
    })

    it('knows which controllers roll their pods on a template change', () => {
        expect(KubeWorkloadCatalog.canRestart(kind('apps', 'deployments'))).toBe(true)
        expect(KubeWorkloadCatalog.canRestart(kind('apps', 'statefulsets'))).toBe(true)
        expect(KubeWorkloadCatalog.canRestart(kind('apps', 'daemonsets'))).toBe(true)
        expect(KubeWorkloadCatalog.canRestart(kind('apps', 'replicasets'))).toBe(false)
    })

    it('offers a manual run for cron jobs only', () => {
        expect(KubeWorkloadCatalog.canTrigger(kind('batch', 'cronjobs'))).toBe(true)
        expect(KubeWorkloadCatalog.canTrigger(kind('batch', 'jobs'))).toBe(false)
    })

    it('forwards a port to what listens on one', () => {
        expect(KubeWorkloadCatalog.canForwardPort(kind('', 'pods'))).toBe(true)
        expect(KubeWorkloadCatalog.canForwardPort(kind('', 'services'))).toBe(true)
        expect(KubeWorkloadCatalog.canForwardPort(kind('apps', 'deployments'))).toBe(false)
        expect(KubeWorkloadCatalog.canForwardPort(kind('', 'nodes'))).toBe(false)
    })

    it('offers nothing the cluster does not let the user patch', () => {
        const readOnly = kind('apps', 'deployments').withDefinition({ verbs: ['list', 'get', 'watch'] })

        expect(KubeWorkloadCatalog.canScale(readOnly)).toBe(false)
        expect(KubeWorkloadCatalog.canRestart(readOnly)).toBe(false)
    })

    it('summarises the four kinds an operator looks at first, in that order', () => {
        const summarised = KubeResourceRegistry.all()
            .filter(candidate => KubeWorkloadCatalog.isSummarised(candidate))
            .sort((a, b) => KubeWorkloadCatalog.summaryOrder(a) - KubeWorkloadCatalog.summaryOrder(b))

        expect(summarised.map(candidate => candidate.kind)).toEqual(['Pod', 'Deployment', 'StatefulSet', 'DaemonSet'])
    })
})
