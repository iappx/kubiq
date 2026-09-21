import { describe, expect, it } from 'vitest'
import { KubeDiscovery, KubeResourceKind, KubeSectionCatalog } from '@/domain/models/kube'
import { KubeDiscoveryFixtures } from '../../support/fixtures/KubeDiscoveryFixtures'

const discover = (): KubeResourceKind[] => KubeDiscovery.discover(KubeDiscoveryFixtures.full())

const find = (kinds: KubeResourceKind[], key: string): KubeResourceKind | undefined =>
    kinds.find(p => p.key === key)

describe('KubeDiscovery', () => {
    it('reports only what the cluster actually serves', () => {
        const kinds = discover()

        expect(find(kinds, '/v1/pods')).toBeDefined()
        expect(find(kinds, 'apps/v1/deployments')).toBeDefined()
        expect(find(kinds, 'batch/v1/cronjobs')).toBeDefined()
        expect(find(kinds, 'storage.k8s.io/v1/storageclasses')).toBeDefined()
    })

    it('drops subresources, which are reached through their parent', () => {
        const kinds = discover()

        expect(kinds.some(p => p.resource.includes('/'))).toBe(false)
        expect(find(kinds, '/v1/pods/log')).toBeUndefined()
        expect(find(kinds, 'apps/v1/deployments/scale')).toBeUndefined()
    })

    it('drops a resource the cluster will not list', () => {
        expect(discover().some(p => p.resource === 'bindings')).toBe(false)
    })

    it('keeps the preferred version of a group and nothing else', () => {
        const kinds = discover()

        expect(find(kinds, 'batch/v1/cronjobs')).toBeDefined()
        expect(find(kinds, 'batch/v1beta1/cronjobs')).toBeUndefined()
    })

    it('picks the best version itself when a group declares no preferred one', () => {
        const kinds = discover()

        expect(find(kinds, 'monitoring.coreos.com/v1/prometheuses')).toBeDefined()
        expect(find(kinds, 'monitoring.coreos.com/v1alpha1/scrapeconfigs')).toBeUndefined()
    })

    it('enriches a known kind from the registry and takes its version and verbs from the cluster', () => {
        const pods = find(discover(), '/v1/pods') as KubeResourceKind

        expect(pods.title).toBe('Pods')
        expect(pods.icon).toBe('Box')
        expect(pods.section).toBe('workloads')
        expect(pods.isCustom).toBe(false)
        expect(pods.columns.some(p => p.key === 'readyText')).toBe(true)
        expect(pods.canDelete).toBe(true)
    })

    it('narrows a kind to the verbs this cluster grants', () => {
        const services = find(discover(), '/v1/services') as KubeResourceKind

        expect(services.canList).toBe(true)
        expect(services.canDelete).toBe(true)
        expect(services.supports('deletecollection')).toBe(false)
    })

    it('files a kind the registry does not know under custom resources', () => {
        const issuers = find(discover(), 'cert-manager.io/v1/issuers') as KubeResourceKind

        expect(issuers.section).toBe(KubeSectionCatalog.custom)
        expect(issuers.isCustom).toBe(true)
        expect(issuers.title).toBe('Issuer')
        expect(issuers.columns.map(p => p.key)).toEqual(['name', 'namespace', 'createdAt'])
    })

    it('takes the columns of a discovered kind from its CRD when there is one', () => {
        const certificates = find(discover(), 'cert-manager.io/v1/certificates') as KubeResourceKind

        expect(certificates.columns.map(p => p.title)).toEqual(['Name', 'Namespace', 'Ready', 'Secret', 'Issuer', 'Age'])
        expect(certificates.columns[2].jsonPath).toBe('.status.conditions[0].status')
        expect(certificates.isCustom).toBe(true)
        expect(certificates.canList).toBe(true)
    })

    it('adds a CRD kind that discovery never reported', () => {
        const input = KubeDiscoveryFixtures.full()
        input.crds = [...input.crds, KubeDiscoveryFixtures.plainCrd()]

        const widgets = find(KubeDiscovery.discover(input), 'example.test/v1/widgets') as KubeResourceKind

        expect(widgets).toBeDefined()
        expect(widgets.namespaced).toBe(false)
        expect(widgets.canList).toBe(true)
    })

    it('orders the result by section and then by title', () => {
        const kinds = discover()
        const orders = kinds.map(p => KubeSectionCatalog.orderOf(p.section))

        expect([...orders].sort((a, b) => a - b)).toEqual(orders)
        expect(kinds[0].section).toBe('cluster')
        expect(kinds[kinds.length - 1].section).toBe(KubeSectionCatalog.custom)
    })

    it('gives every kind a unique key', () => {
        const kinds = discover()

        expect(new Set(kinds.map(p => p.key)).size).toBe(kinds.length)
    })

    it('returns nothing rather than throwing on an empty cluster answer', () => {
        expect(KubeDiscovery.discover({})).toEqual([])
        expect(KubeDiscovery.discover({ resourceLists: [], crds: [] })).toEqual([])
    })
})

describe('KubeDiscovery.preferredVersions', () => {
    it('reads the core version from /api and the group versions from /apis', () => {
        const preferred = KubeDiscovery.preferredVersions(KubeDiscoveryFixtures.full())

        expect(preferred.get('')).toBe('v1')
        expect(preferred.get('apps')).toBe('v1')
        expect(preferred.get('batch')).toBe('v1')
    })

    it('trusts preferredVersion over its own ordering', () => {
        const preferred = KubeDiscovery.preferredVersions({
            groups: {
                groups: [{
                    name: 'apps',
                    versions: [{ version: 'v1' }, { version: 'v2' }],
                    preferredVersion: { version: 'v1' },
                }],
            },
        })

        expect(preferred.get('apps')).toBe('v1')
    })

    it('falls back to the resource lists for a group /apis never mentioned', () => {
        const preferred = KubeDiscovery.preferredVersions({
            resourceLists: [
                { groupVersion: 'example.test/v1beta1', resources: [] },
                { groupVersion: 'example.test/v1', resources: [] },
            ],
        })

        expect(preferred.get('example.test')).toBe('v1')
    })
})

describe('KubeDiscovery.parseGroupVersion', () => {
    it('reads a bare version as the core group', () => {
        expect(KubeDiscovery.parseGroupVersion('v1')).toEqual({ group: '', version: 'v1' })
    })

    it('splits a grouped version on the slash', () => {
        expect(KubeDiscovery.parseGroupVersion('apps/v1')).toEqual({ group: 'apps', version: 'v1' })
        expect(KubeDiscovery.parseGroupVersion('cert-manager.io/v1')).toEqual({
            group: 'cert-manager.io',
            version: 'v1',
        })
    })

    it('gives up on an empty value', () => {
        expect(KubeDiscovery.parseGroupVersion(undefined)).toBeUndefined()
        expect(KubeDiscovery.parseGroupVersion('')).toBeUndefined()
    })
})
