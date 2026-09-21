import { beforeEach, describe, expect, it } from 'vitest'
import { ResourceManifestValidator } from '@/application/validators/ResourceManifestValidator'
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
    verbs: ['list', 'create'],
})

const readOnlyWidgets = widgets.withDefinition({ verbs: ['list'] })

const served = [deployments, widgets]

let validator: ResourceManifestValidator

const manifest = 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: api\n'

describe('ResourceManifestValidator', () => {
    beforeEach(() => {
        validator = new ResourceManifestValidator()
    })

    it('accepts a manifest for a kind the cluster serves', () => {
        expect(validator.validate({ manifest, served })).toEqual({ valid: true, errors: {} })
    })

    it('asks for a manifest before anything else', () => {
        expect(validator.validate({ manifest: '   ', served }).errors.manifest).toContain('Paste')
    })

    it('reports a syntax error with the parser detail behind it', () => {
        const result = validator.validate({ manifest: 'a:\n  - b\n c: d', served })

        expect(result.valid).toBe(false)
        expect(result.errors.manifest.length).toBeGreaterThan(20)
    })

    it('collects every missing field in one pass rather than one at a time', () => {
        const result = validator.validate({ manifest: 'spec:\n  replicas: 1\n', served })

        expect(result.errors.manifest).toContain('apiVersion')
        expect(result.errors.manifest).toContain('kind')
        expect(result.errors.manifest).toContain('metadata.name')
    })

    it('takes generateName instead of a name', () => {
        const generated = 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  generateName: api-\n'

        expect(validator.validate({ manifest: generated, served }).valid).toBe(true)
    })

    it('accepts a custom kind because discovery reported it', () => {
        const custom = 'apiVersion: acme.example.com/v1\nkind: Widget\nmetadata:\n  name: widget-a\n'

        expect(validator.validate({ manifest: custom, served }).valid).toBe(true)
    })

    it('refuses a kind the cluster does not serve, naming it', () => {
        const unknown = 'apiVersion: acme.example.com/v1\nkind: Gadget\nmetadata:\n  name: g\n'

        expect(validator.validate({ manifest: unknown, served }).errors.manifest)
            .toContain('acme.example.com/v1 Gadget')
    })

    it('refuses a kind the cluster will not let the user create', () => {
        const custom = 'apiVersion: acme.example.com/v1\nkind: Widget\nmetadata:\n  name: widget-a\n'

        expect(validator.validate({ manifest: custom, served: [readOnlyWidgets] }).errors.manifest)
            .toContain('cannot create')
    })

    it('locates the kind the same way the create does', () => {
        expect(ResourceManifestValidator.locate(served, 'acme.example.com/v1', 'Widget')).toBe(widgets)
    })

    it('falls back to the registry for a kind discovery did not report', () => {
        expect(ResourceManifestValidator.locate([], 'apps/v1', 'Deployment')?.resource).toBe('deployments')
    })
})
