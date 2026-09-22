import { describe, expect, it } from 'vitest'
import {
    ArgoAnnotations,
    ArgoCapabilities,
    ArgoFinalizers,
    ArgoOperationBuilder,
    ArgoResourceKinds,
    ArgoRevision,
    ArgoSyncDraftDefaults,
    ArgoSyncOptions,
} from '@/domain/models/argocd'
import { KubeResourceKind } from '@/domain/models/kube'
import type { TKubeVerb } from '@/domain/models/kube'

const kind = (resource: string, verbs: TKubeVerb[]) => new KubeResourceKind({
    group: 'argoproj.io',
    version: 'v1alpha1',
    resource,
    kind: 'Application',
    title: resource,
    namespaced: true,
    section: 'custom',
    icon: 'Puzzle',
    columns: [],
    verbs,
    isCustom: true,
})

describe('ArgoCapabilities', () => {
    it('finds Argo CD by the Application resource discovery reported', () => {
        const capabilities = ArgoCapabilities.of([kind('applications', ['list', 'patch', 'delete'])])

        expect(ArgoCapabilities.isInstalled(capabilities)).toBe(true)
        expect(ArgoCapabilities.canSync(capabilities)).toBe(true)
        expect(ArgoCapabilities.canDelete(capabilities)).toBe(true)
    })

    it('is not installed when the cluster serves no Application resource', () => {
        expect(ArgoCapabilities.isInstalled(ArgoCapabilities.of([]))).toBe(false)
    })

    // A kind the user cannot list is a screen that opens on a 403; discovery already says so.
    it('ignores a kind this user is not allowed to list', () => {
        const capabilities = ArgoCapabilities.of([kind('applications', ['get'])])

        expect(ArgoCapabilities.isInstalled(capabilities)).toBe(false)
    })

    it('reports read-only access as installed but unable to sync or delete', () => {
        const capabilities = ArgoCapabilities.of([kind('applications', ['list', 'get'])])

        expect(ArgoCapabilities.isInstalled(capabilities)).toBe(true)
        expect(ArgoCapabilities.canSync(capabilities)).toBe(false)
        expect(ArgoCapabilities.canDelete(capabilities)).toBe(false)
    })

    it('picks up projects and application sets separately from applications', () => {
        const capabilities = ArgoCapabilities.of([
            kind('applications', ['list']),
            kind('appprojects', ['list']),
        ])

        expect(capabilities.appProjects).toBeDefined()
        expect(capabilities.applicationSets).toBeUndefined()
    })
})

describe('ArgoResourceKinds', () => {
    it('addresses the group and version Argo CD serves', () => {
        expect(ArgoResourceKinds.applications().basePath).toBe('/apis/argoproj.io/v1alpha1')
        expect(ArgoResourceKinds.applications().listPath('argocd'))
            .toBe('/apis/argoproj.io/v1alpha1/namespaces/argocd/applications')
    })

    it('keys each kind apart so the entity sets do not collide', () => {
        const keys = [
            ArgoResourceKinds.applications().registryKey,
            ArgoResourceKinds.appProjects().registryKey,
            ArgoResourceKinds.applicationSets().registryKey,
        ]

        expect(new Set(keys).size).toBe(3)
    })
})

describe('ArgoOperationBuilder', () => {
    it('writes the sync request the application controller reads', () => {
        const operation = ArgoOperationBuilder.sync(ArgoSyncDraftDefaults.blank())

        expect(operation).toEqual({
            initiatedBy: { username: 'kubiq', automated: false },
            sync: { prune: false, dryRun: false },
        })
    })

    it('leaves the revision out when none was asked for, so Argo CD uses the tracked one', () => {
        const operation = ArgoOperationBuilder.sync(ArgoSyncDraftDefaults.atRevision('   '))

        expect(operation.sync?.revision).toBeUndefined()
    })

    it('carries the revision and the source a rollback replays', () => {
        const source = { repoURL: 'https://git/acme/web', path: 'deploy', targetRevision: 'v1.2.0' }
        const operation = ArgoOperationBuilder.sync(ArgoSyncDraftDefaults.atRevision('abc123'), source)

        expect(operation.sync?.revision).toBe('abc123')
        expect(operation.sync?.source).toEqual(source)
    })

    it('turns the toggles into the option strings Argo CD understands', () => {
        const operation = ArgoOperationBuilder.sync({
            revision: '',
            prune: true,
            dryRun: true,
            force: true,
            replace: true,
            applyOutOfSyncOnly: false,
        })

        expect(operation.sync?.prune).toBe(true)
        expect(operation.sync?.dryRun).toBe(true)
        expect(operation.sync?.syncOptions).toEqual([ArgoSyncOptions.force, ArgoSyncOptions.replace])
    })

    it('sends no syncOptions key at all when no option was chosen', () => {
        expect(ArgoOperationBuilder.sync(ArgoSyncDraftDefaults.blank()).sync?.syncOptions).toBeUndefined()
    })
})

describe('ArgoFinalizers', () => {
    it('adds the cascade finalizer when the resources should go with the application', () => {
        expect(ArgoFinalizers.desired([], true)).toEqual([ArgoAnnotations.resourcesFinalizer])
    })

    it('removes it when the resources should stay behind', () => {
        expect(ArgoFinalizers.desired([ArgoAnnotations.resourcesFinalizer], false)).toEqual([])
    })

    it('keeps finalizers that belong to somebody else', () => {
        const kept = ArgoFinalizers.desired(['other/finalizer', ArgoAnnotations.resourcesFinalizer], false)

        expect(kept).toEqual(['other/finalizer'])
    })

    it('does not add the same finalizer twice', () => {
        const once = ArgoFinalizers.desired([ArgoAnnotations.resourcesFinalizer], true)

        expect(once).toEqual([ArgoAnnotations.resourcesFinalizer])
    })

    it('says what a delete would do right now', () => {
        expect(ArgoFinalizers.hasCascade([ArgoAnnotations.resourcesFinalizer])).toBe(true)
        expect(ArgoFinalizers.hasCascade([])).toBe(false)
    })

    it('compares two lists so an unchanged one is never patched', () => {
        expect(ArgoFinalizers.same(['a'], ['a'])).toBe(true)
        expect(ArgoFinalizers.same(['a'], ['a', 'b'])).toBe(false)
    })
})

describe('ArgoRevision', () => {
    it('abbreviates a git commit', () => {
        expect(ArgoRevision.short('0123456789abcdef0123456789abcdef01234567')).toBe('0123456')
    })

    it('leaves a chart version whole', () => {
        expect(ArgoRevision.short('15.1.0')).toBe('15.1.0')
    })

    it('leaves a branch name whole', () => {
        expect(ArgoRevision.short('main')).toBe('main')
    })
})

describe('ArgoAnnotations', () => {
    it('names the refresh the operator asked for', () => {
        expect(ArgoAnnotations.refreshValue(false)).toBe('normal')
        expect(ArgoAnnotations.refreshValue(true)).toBe('hard')
    })
})
