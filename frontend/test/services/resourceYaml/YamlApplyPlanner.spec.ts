import { describe, expect, it } from 'vitest'
import type { EntityAttribute } from '@iappx/entity-repo'
import { YamlApplyPlanner } from '@/application/services/resourceYaml/models/YamlApplyPlanner'

const attributes: Record<string, EntityAttribute> = {
    uid: { isPrimaryKey: true, isClientOnly: true },
    apiVersion: {},
    kind: {},
    metadata: {},
    spec: {},
    status: { isReadonly: true },
}

const current = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: 'api', resourceVersion: '4011', labels: { app: 'api', tier: 'web' } },
    spec: { replicas: 3 },
    status: { readyReplicas: 3 },
}

const plan = (edited: Record<string, unknown>, canPatch = true, canUpdate = true) =>
    YamlApplyPlanner.plan(current, edited, attributes, canPatch, canUpdate)

describe('YamlApplyPlanner', () => {
    it('does nothing when the document means the same thing', () => {
        expect(plan({ ...current, metadata: { resourceVersion: '4011', name: 'api', labels: { tier: 'web', app: 'api' } } }))
            .toMatchObject({ mode: 'noop', fields: [] })
    })

    it('patches only the fields that changed', () => {
        expect(plan({ ...current, spec: { replicas: 5 } })).toMatchObject({ mode: 'patch', fields: ['spec'] })
    })

    it('replaces the object when a nested key was deleted', () => {
        const edited = { ...current, metadata: { name: 'api', resourceVersion: '4011', labels: { app: 'api' } } }

        expect(plan(edited)).toMatchObject({ mode: 'replace' })
    })

    it('replaces the object when a whole top-level field was deleted', () => {
        const { spec, ...withoutSpec } = current
        void spec

        expect(plan(withoutSpec)).toMatchObject({ mode: 'replace' })
    })

    it('replaces when the kind has no patch verb', () => {
        expect(plan({ ...current, spec: { replicas: 5 } }, false, true)).toMatchObject({ mode: 'replace' })
    })

    it('refuses a deletion the cluster gives it no way to express', () => {
        const edited = { ...current, metadata: { name: 'api', resourceVersion: '4011', labels: { app: 'api' } } }

        expect(plan(edited, true, false)).toMatchObject({ mode: 'patch', unsupported: ['metadata'] })
    })

    it('never sends a field the cluster owns, and says it was left out', () => {
        const edited = { ...current, status: { readyReplicas: 1 } }

        expect(plan(edited)).toMatchObject({ mode: 'noop', ignored: ['status'] })
    })

    it('applies the rest of the edit even when a cluster-owned field was touched too', () => {
        const edited = { ...current, spec: { replicas: 5 }, status: { readyReplicas: 1 } }

        expect(plan(edited)).toMatchObject({ mode: 'patch', fields: ['spec'], ignored: ['status'] })
    })

    it('refuses to patch a field the entity cannot express', () => {
        expect(plan({ ...current, stringData: { token: 'x' } })).toMatchObject({ unsupported: ['stringData'] })
    })

    it('refuses to replace when the document carries a field the entity cannot express', () => {
        const edited = { ...current, metadata: { name: 'api', resourceVersion: '4011' }, extraThing: 1 }

        expect(plan(edited)).toMatchObject({ mode: 'replace', unsupported: ['extraThing'] })
    })

    it('does not call a cluster-owned field unsupported just because it is in the document', () => {
        expect(plan({ ...current, spec: { replicas: 5 } }).unsupported).toEqual([])
    })
})
