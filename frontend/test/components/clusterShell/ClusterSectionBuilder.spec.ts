import { describe, expect, it } from 'vitest'
import { ClusterSectionBuilder } from '@/components/clusterShell/ClusterSectionBuilder'
import { KubeDiscovery, KubeResourceRegistry, KubeSectionCatalog } from '@/domain/models/kube'
import type { TApiResourceListDocument } from '@/domain/models/kube'

const coreList: TApiResourceListDocument = {
    groupVersion: 'v1',
    resources: [
        { name: 'pods', kind: 'Pod', namespaced: true, verbs: ['get', 'list', 'watch', 'delete'] },
        { name: 'pods/log', kind: 'Pod', namespaced: true, verbs: ['get'] },
        { name: 'nodes', kind: 'Node', namespaced: false, verbs: ['get', 'list'] },
        { name: 'secrets', kind: 'Secret', namespaced: true, verbs: ['get'] },
    ],
}

const appsList: TApiResourceListDocument = {
    groupVersion: 'apps/v1',
    resources: [
        { name: 'deployments', kind: 'Deployment', namespaced: true, verbs: ['get', 'list', 'delete'] },
    ],
}

const customList: TApiResourceListDocument = {
    groupVersion: 'acme.example.com/v1alpha1',
    resources: [
        { name: 'widgets', kind: 'Widget', namespaced: true, verbs: ['get', 'list'] },
    ],
}

const capiList: TApiResourceListDocument = {
    groupVersion: 'cluster.x-k8s.io/v1beta1',
    resources: [
        { name: 'machines', kind: 'Machine', namespaced: true, verbs: ['get', 'list'] },
        { name: 'clusters', kind: 'Cluster', namespaced: true, verbs: ['get', 'list'] },
    ],
}

const cnpgList: TApiResourceListDocument = {
    groupVersion: 'postgresql.cnpg.io/v1',
    resources: [
        { name: 'clusters', kind: 'Cluster', namespaced: true, verbs: ['get', 'list'] },
    ],
}

const coreCustomList: TApiResourceListDocument = {
    groupVersion: 'v1',
    resources: [
        { name: 'quantumthings', kind: 'QuantumThing', namespaced: true, verbs: ['get', 'list'] },
    ],
}

const discover = (lists: TApiResourceListDocument[]) => KubeDiscovery.discover({ resourceLists: lists })

const titles = (sections: ReturnType<typeof ClusterSectionBuilder.build>) =>
    sections.flatMap(section => section.items.map(item => item.title))

describe('ClusterSectionBuilder', () => {
    it('groups what the cluster serves under the catalogue sections', () => {
        const sections = ClusterSectionBuilder.build(discover([coreList, appsList]))

        expect(sections.map(section => section.title)).toEqual(['Cluster', 'Workloads'])
    })

    it('shows no section whose every kind was filtered out', () => {
        const sections = ClusterSectionBuilder.build(discover([coreList]))

        expect(sections.map(section => section.title)).not.toContain('Config')
    })

    it('leaves out a kind the cluster does not serve at all', () => {
        const sections = ClusterSectionBuilder.build(discover([coreList]))

        expect(titles(sections)).not.toContain('Deployments')
    })

    it('leaves out a kind the user cannot list rather than showing it greyed out', () => {
        const sections = ClusterSectionBuilder.build(discover([coreList]))

        expect(titles(sections)).toContain('Pods')
        expect(titles(sections)).not.toContain('Secrets')
    })

    it('leaves out a subresource, which is reached through its parent', () => {
        const sections = ClusterSectionBuilder.build(discover([coreList]))

        expect(titles(sections)).toEqual(['Nodes', 'Pods'])
    })

    it('takes the title, icon and section of a kind the registry knows', () => {
        const sections = ClusterSectionBuilder.build(discover([appsList]))

        expect(sections[0].items[0]).toMatchObject({
            title: 'Deployments',
            icon: 'Layers',
            section: 'workloads',
            slug: 'deployments.apps',
        })
    })

    it('puts a kind the registry has never heard of under Custom Resources', () => {
        const sections = ClusterSectionBuilder.build(discover([customList]))

        expect(sections).toHaveLength(1)
        expect(sections[0].title).toBe('Custom Resources')
        expect(sections[0].items[0]).toMatchObject({ title: 'Widget', slug: 'widgets.acme.example.com' })
    })

    it('offers every registry entry the cluster serves, naming none of them itself', () => {
        const registry = KubeResourceRegistry.all()
        const sections = ClusterSectionBuilder.build(registry)

        expect(titles(sections).sort()).toEqual(registry.map(kind => kind.title).sort())
    })

    it('keeps the catalogue order between sections and sorts kinds inside one', () => {
        const sections = ClusterSectionBuilder.build(KubeResourceRegistry.all())
        const order = sections.map(section => KubeSectionCatalog.orderOf(section.key))

        expect(order).toEqual([...order].sort((a, b) => a - b))
        sections.forEach((section) => {
            const names = section.items.map(item => item.title)
            expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
        })
    })

    it('shows no section at all when the cluster serves nothing listable', () => {
        expect(ClusterSectionBuilder.build([])).toEqual([])
    })

    it('finds a menu item by the slug the address bar carries', () => {
        const sections = ClusterSectionBuilder.build(discover([coreList, appsList]))

        expect(ClusterSectionBuilder.findBySlug(sections, 'deployments.apps')?.title).toBe('Deployments')
        expect(ClusterSectionBuilder.findBySlug(sections, 'widgets.acme.example.com')).toBeUndefined()
    })

    it('names the first kind of the first section as where the shell lands', () => {
        const sections = ClusterSectionBuilder.build(discover([coreList, appsList]))

        expect(ClusterSectionBuilder.first(sections)?.title).toBe('Nodes')
        expect(ClusterSectionBuilder.first([])).toBeUndefined()
    })

    it('carries the API group of a kind onto its menu item', () => {
        const sections = ClusterSectionBuilder.build(discover([appsList]))

        expect(sections[0].items[0].group).toBe('apps')
    })
})

describe('ClusterSectionBuilder sub-groups', () => {
    it('splits Custom Resources into one sub-group per API group, sorted by group name', () => {
        const sections = ClusterSectionBuilder.build(discover([cnpgList, capiList]))

        expect(sections[0].groups.map(group => group.title)).toEqual(['cluster.x-k8s.io', 'postgresql.cnpg.io'])
    })

    it('sorts the kinds of a sub-group by title', () => {
        const sections = ClusterSectionBuilder.build(discover([capiList]))

        expect(sections[0].groups[0].items.map(item => item.title)).toEqual(['Cluster', 'Machine'])
    })

    it('tells two same-named kinds apart by the sub-group each one sits in', () => {
        const sections = ClusterSectionBuilder.build(discover([capiList, cnpgList]))
        const clusters = sections[0].groups.map(group => ({
            group: group.title,
            slugs: group.items.filter(item => item.title === 'Cluster').map(item => item.slug),
        }))

        expect(clusters).toEqual([
            { group: 'cluster.x-k8s.io', slugs: ['clusters.cluster.x-k8s.io'] },
            { group: 'postgresql.cnpg.io', slugs: ['clusters.postgresql.cnpg.io'] },
        ])
    })

    it('puts a kind with no API group in the core group, last', () => {
        const sections = ClusterSectionBuilder.build(discover([coreCustomList, capiList]))

        expect(sections[0].groups.map(group => group.title))
            .toEqual(['cluster.x-k8s.io', ClusterSectionBuilder.coreGroupTitle])
    })

    it('leaves every built-in section ungrouped', () => {
        const sections = ClusterSectionBuilder.build(discover([coreList, appsList]))

        expect(sections.every(section => section.groups.length === 0)).toBe(true)
    })

    it('keeps the flat item list of a grouped section in sub-group order', () => {
        const sections = ClusterSectionBuilder.build(discover([cnpgList, capiList, coreCustomList]))

        expect(sections[0].items.map(item => item.slug)).toEqual([
            'clusters.cluster.x-k8s.io',
            'machines.cluster.x-k8s.io',
            'clusters.postgresql.cnpg.io',
            'quantumthings',
        ])
    })

    it('finds a kind that sits inside a sub-group by its slug', () => {
        const sections = ClusterSectionBuilder.build(discover([capiList, cnpgList]))

        expect(ClusterSectionBuilder.findBySlug(sections, 'clusters.postgresql.cnpg.io')?.title).toBe('Cluster')
    })

    it('lands on the first kind of the first sub-group when the cluster serves only CRDs', () => {
        const sections = ClusterSectionBuilder.build(discover([cnpgList, capiList]))

        expect(ClusterSectionBuilder.first(sections)?.slug).toBe('clusters.cluster.x-k8s.io')
    })

    it('names the sub-group that holds a slug, so the sidebar can reveal it', () => {
        const section = ClusterSectionBuilder.build(discover([capiList, cnpgList]))[0]

        expect(ClusterSectionBuilder.groupOf(section, 'machines.cluster.x-k8s.io')?.title).toBe('cluster.x-k8s.io')
        expect(ClusterSectionBuilder.groupOf(section, 'nothing.served.here')).toBeUndefined()
    })

    it('has no sub-group to reveal for a built-in section', () => {
        const section = ClusterSectionBuilder.build(discover([appsList]))[0]

        expect(ClusterSectionBuilder.groupOf(section, 'deployments.apps')).toBeUndefined()
    })
})
