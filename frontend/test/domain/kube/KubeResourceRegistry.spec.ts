import { describe, expect, it } from 'vitest'
import { KubeResourceKind, KubeResourceRegistry, KubeSectionCatalog } from '@/domain/models/kube'

describe('KubeResourceRegistry', () => {
    it('knows the built-in kinds by group and resource, without a version', () => {
        expect(KubeResourceRegistry.find('', 'pods')?.kind).toBe('Pod')
        expect(KubeResourceRegistry.find('apps', 'deployments')?.kind).toBe('Deployment')
        expect(KubeResourceRegistry.find('rbac.authorization.k8s.io', 'clusterroles')?.kind).toBe('ClusterRole')
        expect(KubeResourceRegistry.has('example.test', 'widgets')).toBe(false)
    })

    it('covers every section', () => {
        const sections = new Set(KubeResourceRegistry.all().map(p => p.section))

        for (const section of KubeSectionCatalog.all()) {
            expect(sections.has(section)).toBe(true)
        }
    })

    it('puts nothing in the custom section but the definitions themselves', () => {
        const custom = KubeResourceRegistry.all().filter(p => p.section === KubeSectionCatalog.custom)

        expect(custom.map(p => p.kind)).toEqual(['CustomResourceDefinition'])
    })

    it('holds one entry per group and resource', () => {
        const kinds = KubeResourceRegistry.all()
        const keys = new Set(kinds.map(p => p.registryKey))

        expect(keys.size).toBe(kinds.length)
    })

    it('describes every kind fully enough to render a table', () => {
        for (const kind of KubeResourceRegistry.all()) {
            expect(kind.title.length).toBeGreaterThan(0)
            expect(kind.icon.length).toBeGreaterThan(0)
            expect(kind.columns.length).toBeGreaterThan(0)
            expect(kind.isCustom).toBe(false)
            expect(kind.canList).toBe(true)
        }
    })

    it('leads every table with the name, except the event log', () => {
        for (const kind of KubeResourceRegistry.all()) {
            const expected = kind.kind === 'Event' ? 'lastSeen' : 'name'
            expect(kind.columns[0].key).toBe(expected)
        }
    })

    it('shows the container indicator beside Ready, and only on pods', () => {
        const pods = KubeResourceRegistry.find('', 'pods') as KubeResourceKind
        const keys = pods.columns.map(column => column.key)

        expect(keys.indexOf('containerHealth')).toBe(keys.indexOf('readyText') + 1)

        const others = KubeResourceRegistry.all()
            .filter(kind => kind.columns.some(column => column.key === 'containerHealth'))
            .map(kind => kind.kind)

        expect(others).toEqual(['Pod'])
    })

    it('gives a namespace column to namespaced kinds only', () => {
        for (const kind of KubeResourceRegistry.all()) {
            const hasNamespaceColumn = kind.columns.some(p => p.key === 'namespace')
            expect(hasNamespaceColumn).toBe(kind.namespaced)
        }
    })

    it('never declares a column without a key and a title', () => {
        for (const kind of KubeResourceRegistry.all()) {
            for (const column of kind.columns) {
                expect(column.key.length).toBeGreaterThan(0)
                expect(column.title.length).toBeGreaterThan(0)
                expect(column.jsonPath).toBeUndefined()
            }
        }
    })

    it('hands out a fresh list, so a caller cannot edit the registry', () => {
        KubeResourceRegistry.all().pop()

        expect(KubeResourceRegistry.all().length).toBeGreaterThan(20)
    })
})

describe('KubeResourceKind', () => {
    it('addresses a core resource under /api and a grouped one under /apis', () => {
        const pods = KubeResourceRegistry.find('', 'pods') as KubeResourceKind
        const deployments = KubeResourceRegistry.find('apps', 'deployments') as KubeResourceKind

        expect(pods.apiVersion).toBe('v1')
        expect(pods.basePath).toBe('/api/v1')
        expect(deployments.apiVersion).toBe('apps/v1')
        expect(deployments.basePath).toBe('/apis/apps/v1')
    })

    it('scopes a list to a namespace only when the kind is namespaced', () => {
        const pods = KubeResourceRegistry.find('', 'pods') as KubeResourceKind
        const nodes = KubeResourceRegistry.find('', 'nodes') as KubeResourceKind

        expect(pods.listPath()).toBe('/api/v1/pods')
        expect(pods.listPath('default')).toBe('/api/v1/namespaces/default/pods')
        expect(pods.objectPath('web', 'default')).toBe('/api/v1/namespaces/default/pods/web')
        expect(nodes.listPath('default')).toBe('/api/v1/nodes')
        expect(nodes.objectPath('worker-1')).toBe('/api/v1/nodes/worker-1')
    })

    it('answers what the cluster allows from its verbs', () => {
        const readOnly = new KubeResourceKind({
            group: '', version: 'v1', resource: 'pods', kind: 'Pod', title: 'Pods',
            namespaced: true, section: 'workloads', icon: 'Box', columns: [], verbs: ['get', 'list', 'watch'],
        })

        expect(readOnly.canList).toBe(true)
        expect(readOnly.canWatch).toBe(true)
        expect(readOnly.canCreate).toBe(false)
        expect(readOnly.canUpdate).toBe(false)
        expect(readOnly.canPatch).toBe(false)
        expect(readOnly.canDelete).toBe(false)
    })

    it('builds a changed copy and leaves the original alone', () => {
        const pods = KubeResourceRegistry.find('', 'pods') as KubeResourceKind
        const changed = pods.withDefinition({ version: 'v2', verbs: ['list'] })

        expect(changed.version).toBe('v2')
        expect(changed.key).toBe('/v2/pods')
        expect(changed.kind).toBe('Pod')
        expect(changed.columns).toEqual(pods.columns)
        expect(pods.version).toBe('v1')
        expect(pods.canDelete).toBe(true)
    })

    it('keys a kind by its full gvr and registers it without the version', () => {
        const deployments = KubeResourceRegistry.find('apps', 'deployments') as KubeResourceKind

        expect(deployments.key).toBe('apps/v1/deployments')
        expect(deployments.registryKey).toBe('apps/deployments')
        expect(deployments.gvr).toEqual({ group: 'apps', version: 'v1', resource: 'deployments' })
    })
})
