import { describe, expect, it } from 'vitest'
import { DetailTabs } from '@/components/resource/detail/DetailTabs'
import { KubeResourceRegistry } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'

const kind = (group: string, resource: string): KubeResourceKind => KubeResourceRegistry.find(group, resource)!

const pods = kind('', 'pods')
const nodes = kind('', 'nodes')
const secrets = kind('', 'secrets')

const keysOf = (of: KubeResourceKind | null): string[] => DetailTabs.of(of).map(tab => tab.key)

const templated = [
    kind('apps', 'deployments'),
    kind('apps', 'statefulsets'),
    kind('apps', 'daemonsets'),
    kind('apps', 'replicasets'),
    kind('', 'replicationcontrollers'),
    kind('batch', 'jobs'),
    kind('batch', 'cronjobs'),
]

describe('DetailTabs environment', () => {
    it('sits with the other kind-specific tabs, between the overview and the details', () => {
        expect(keysOf(pods)).toEqual(['overview', 'environment', 'details', 'metadata', 'events', 'yaml'])
    })

    it('is offered on every kind that carries a pod template', () => {
        templated.forEach((workload) => {
            expect(keysOf(workload)).toContain(DetailTabs.environmentKey)
        })
    })

    it('keeps the same slot on a workload as it has on a pod', () => {
        expect(keysOf(kind('apps', 'deployments')))
            .toEqual(['overview', 'environment', 'details', 'metadata', 'events', 'yaml'])
    })

    it('is offered on nothing that has no containers of its own', () => {
        expect(keysOf(nodes)).not.toContain(DetailTabs.environmentKey)
        expect(keysOf(secrets)).not.toContain(DetailTabs.environmentKey)
        expect(keysOf(kind('', 'services'))).not.toContain(DetailTabs.environmentKey)
        expect(keysOf(kind('', 'configmaps'))).not.toContain(DetailTabs.environmentKey)
        expect(keysOf(null)).not.toContain(DetailTabs.environmentKey)
    })

    it('answers on its own whether a kind has an environment to show', () => {
        expect(DetailTabs.hasEnvironment(pods)).toBe(true)
        expect(DetailTabs.hasEnvironment(kind('batch', 'cronjobs'))).toBe(true)
        expect(DetailTabs.hasEnvironment(nodes)).toBe(false)
    })

    it('leaves the pods tab of a node where it was', () => {
        expect(keysOf(nodes)).toEqual(['overview', 'pods', 'details', 'metadata', 'events', 'yaml'])
    })
})
