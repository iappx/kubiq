import { describe, expect, it } from 'vitest'
import { KubeKindLocator, KubeManifest, KubePodRelations, KubeResourceKind } from '@/domain/models/kube'

const kindOf = (group: string, version: string, kind: string) => new KubeResourceKind({
    group,
    version,
    resource: `${kind.toLowerCase()}s`,
    kind,
    title: `${kind}s`,
    namespaced: true,
    section: 'workloads',
    icon: 'Box',
    columns: [],
    verbs: ['list'],
})

describe('KubeManifest', () => {
    const object = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: 'api', namespace: 'payments', uid: 'd-1', resourceVersion: '4011', managedFields: [{}] },
    }

    it('reads the identity of an object out of its own shape', () => {
        expect(KubeManifest.apiVersionOf(object)).toBe('apps/v1')
        expect(KubeManifest.kindOf(object)).toBe('Deployment')
        expect(KubeManifest.nameOf(object)).toBe('api')
        expect(KubeManifest.namespaceOf(object)).toBe('payments')
        expect(KubeManifest.uidOf(object)).toBe('d-1')
        expect(KubeManifest.resourceVersionOf(object)).toBe('4011')
    })

    it('answers with empty text rather than undefined for a document that has nothing', () => {
        expect(KubeManifest.nameOf({})).toBe('')
        expect(KubeManifest.metadataOf({ metadata: 'nonsense' })).toEqual({})
    })

    it('strips managedFields and leaves the rest of metadata alone', () => {
        const readable = KubeManifest.readable(object)

        expect(KubeManifest.metadataOf(readable).managedFields).toBeUndefined()
        expect(KubeManifest.metadataOf(readable).name).toBe('api')
        expect(KubeManifest.metadataOf(object).managedFields).toBeDefined()
    })

    it('carries a draft onto another resourceVersion without touching anything else', () => {
        const rebased = KubeManifest.withResourceVersion(object, '4099')

        expect(KubeManifest.resourceVersionOf(rebased)).toBe('4099')
        expect(KubeManifest.nameOf(rebased)).toBe('api')
    })
})

describe('KubeKindLocator', () => {
    const served = [kindOf('apps', 'v1', 'Deployment'), kindOf('', 'v1', 'Pod')]

    it('splits a grouped apiVersion', () => {
        expect(KubeKindLocator.parseApiVersion('apps/v1')).toMatchObject({ group: 'apps', version: 'v1' })
    })

    it('reads a core apiVersion as the empty group', () => {
        expect(KubeKindLocator.parseApiVersion('v1')).toMatchObject({ group: '', version: 'v1' })
    })

    it('finds the kind the document names', () => {
        expect(KubeKindLocator.find(served, 'apps/v1', 'Deployment')?.resource).toBe('deployments')
        expect(KubeKindLocator.find(served, 'v1', 'Pod')?.resource).toBe('pods')
    })

    it('falls back to another version of the same group rather than giving up', () => {
        expect(KubeKindLocator.find(served, 'apps/v1beta1', 'Deployment')?.version).toBe('v1')
    })

    it('does not cross groups', () => {
        expect(KubeKindLocator.find(served, 'extensions/v1', 'Pod')).toBeUndefined()
    })
})

describe('KubePodRelations', () => {
    const pod = {
        metadata: { name: 'api-0', namespace: 'payments', labels: { app: 'api', tier: 'web' } },
        spec: {
            volumes: [
                { name: 'data', persistentVolumeClaim: { claimName: 'api-data' } },
                { name: 'config', configMap: { name: 'api-config' } },
                { name: 'data-again', persistentVolumeClaim: { claimName: 'api-data' } },
            ],
        },
    }

    it('names every claim the pod mounts, once each', () => {
        expect(KubePodRelations.claimNames(pod)).toEqual(['api-data'])
    })

    it('finds no claims in a pod with no volumes', () => {
        expect(KubePodRelations.claimNames({ spec: {} })).toEqual([])
    })

    it('matches a selector that is a subset of the labels', () => {
        expect(KubePodRelations.matchesSelector(KubePodRelations.labelsOf(pod), { app: 'api' })).toBe(true)
    })

    it('does not match when one label differs', () => {
        expect(KubePodRelations.matchesSelector(KubePodRelations.labelsOf(pod), { app: 'api', tier: 'db' })).toBe(false)
    })

    // Not the "matches everything" an empty selector means elsewhere in Kubernetes: a Service
    // with no selector is fed by hand-written Endpoints.
    it('treats an empty selector as selecting nothing', () => {
        expect(KubePodRelations.matchesSelector(KubePodRelations.labelsOf(pod), {})).toBe(false)
        expect(KubePodRelations.matchesSelector(KubePodRelations.labelsOf(pod), undefined)).toBe(false)
    })
})
