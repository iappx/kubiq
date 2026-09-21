import { describe, expect, it } from 'vitest'
import { KubeSchemaBuilder } from '@/application/services/kubeSchema/models/KubeSchemaBuilder'
import { KubeResourceKind, KubeResourceRegistry } from '@/domain/models/kube'

const deployments = KubeResourceRegistry.find('apps', 'deployments')!

const widgets = new KubeResourceKind({
    group: 'acme.example.com',
    version: 'v1',
    resource: 'widgets',
    kind: 'Widget',
    title: 'Widgets',
    namespaced: true,
    section: 'custom',
    icon: 'Puzzle',
    columns: [],
    verbs: ['list'],
})

const document = {
    components: {
        schemas: {
            'io.k8s.api.apps.v1.Deployment': {
                type: 'object',
                properties: { spec: { $ref: '#/components/schemas/io.k8s.api.apps.v1.DeploymentSpec' } },
                'x-kubernetes-group-version-kind': [{ group: 'apps', kind: 'Deployment', version: 'v1' }],
            },
            'io.k8s.api.apps.v1.DeploymentSpec': { type: 'object' },
            'io.k8s.api.apps.v1.DeploymentList': {
                'x-kubernetes-group-version-kind': [{ group: 'apps', kind: 'DeploymentList', version: 'v1' }],
            },
        },
    },
}

describe('KubeSchemaBuilder', () => {
    it('finds the component by the group, version and kind the cluster declares', () => {
        expect(KubeSchemaBuilder.nameOf(document.components.schemas, deployments))
            .toBe('io.k8s.api.apps.v1.Deployment')
    })

    // Draft-07 ignores the siblings of a bare $ref at the root, hence the allOf wrapper.
    it('points at the component through an allOf and carries the map along', () => {
        const schema = KubeSchemaBuilder.forKind(document, deployments)

        expect(schema).toMatchObject({
            allOf: [{ $ref: '#/components/schemas/io.k8s.api.apps.v1.Deployment' }],
        })
        expect((schema?.components as Record<string, unknown>).schemas).toBe(document.components.schemas)
    })

    it('answers with nothing for a kind the document does not describe', () => {
        expect(KubeSchemaBuilder.forKind(document, widgets)).toBeUndefined()
    })

    it('answers with nothing when the cluster served no document at all', () => {
        expect(KubeSchemaBuilder.forKind(undefined, deployments)).toBeUndefined()
    })

    it('does not mistake the list kind for the object kind', () => {
        const schema = KubeSchemaBuilder.forKind(document, deployments)

        expect(JSON.stringify(schema?.allOf)).not.toContain('DeploymentList')
    })

    it('ignores a component that declares no group-version-kind', () => {
        const bare = { components: { schemas: { 'some.Type': { type: 'object' } } } }

        expect(KubeSchemaBuilder.forKind(bare, deployments)).toBeUndefined()
    })
})
