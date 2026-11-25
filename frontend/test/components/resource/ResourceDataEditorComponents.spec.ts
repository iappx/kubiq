import { describe, expect, it, vi } from 'vitest'

vi.mock('@iappx/vue-facing-di', () => ({
    Component: () => <T>(target: T): T => target,
    Prop: () => () => undefined,
    VModel: () => () => undefined,
    Watch: () => () => undefined,
    VueBase: class {},
}))

import { ResourceDataKeyValidator } from '@/application/validators/ResourceDataKeyValidator'
import { DetailDataEntries } from '@/components/resource/detail/DetailDataEntries'
import ResourceDataEditDialog from '@/components/resource/detail/ResourceDataEditDialog.vue'
import ResourceDataRow from '@/components/resource/detail/ResourceDataRow.vue'
import ResourceDataSection from '@/components/resource/detail/ResourceDataSection.vue'
import type { TDetailDataEntry } from '@/components/resource/detail/types/TDetailDataEntry'
import { KubeResourceRegistry } from '@/domain/models/kube'
import type { KubeResourceKind, TKubeVerb } from '@/domain/models/kube'
import { ResourceObjectStateFactory } from '@/store/modules/resourceObject/ResourceObjectStateFactory'
import type { ResourceObjectStore } from '@/store/modules/resourceObject/ResourceObjectStore'
import type { TResourceObjectRef } from '@/store/modules/resourceObject/types/TResourceObjectRef'
import type { TResourceObjectState } from '@/store/modules/resourceObject/types/TResourceObjectState'

type TDataRowInstance = {
    entry: TDetailDataEntry
    object: Record<string, unknown>
    editable?: boolean
    deletable?: boolean
    readonly canEdit: boolean
    readonly canDelete: boolean
}

type TEditDialogInstance = {
    open: boolean
    isSecret: boolean
    existingKeys: string[]
    initialKey?: string
    initialValue?: string
    busy?: boolean
    canRename?: boolean
    draft: { key: string; value: string; originalKey?: string }
    errors: Record<string, string>
    readonly isEdit: boolean
    readonly keyLocked: boolean
    $emit: ReturnType<typeof vi.fn>
    openChanged: (open: boolean) => void
    submit: () => void
}

type TDataSectionInstance = {
    state: TResourceObjectState
    target: TResourceObjectRef
    readonly canEdit: boolean
    readonly canDelete: boolean
}

const makeRow = (
    object: Record<string, unknown>,
    entry: TDetailDataEntry,
    flags: { editable?: boolean; deletable?: boolean },
): TDataRowInstance => {
    const row = new (ResourceDataRow as unknown as new () => TDataRowInstance)()
    row.object = object
    row.entry = entry
    row.editable = flags.editable
    row.deletable = flags.deletable

    return row
}

const makeDialog = (options: {
    initialKey?: string
    initialValue?: string
    existingKeys?: string[]
    canRename?: boolean
    isSecret?: boolean
}): TEditDialogInstance => {
    const dialog = new (ResourceDataEditDialog as unknown as new (validator: ResourceDataKeyValidator) => TEditDialogInstance)(
        new ResourceDataKeyValidator(),
    )
    dialog.open = true
    dialog.isSecret = options.isSecret ?? false
    dialog.existingKeys = options.existingKeys ?? ['alpha']
    dialog.initialKey = options.initialKey ?? ''
    dialog.initialValue = options.initialValue ?? ''
    dialog.busy = false
    dialog.canRename = options.canRename ?? true
    dialog.$emit = vi.fn()
    dialog.openChanged(true)

    return dialog
}

const makeKind = (verbs: TKubeVerb[]): KubeResourceKind => KubeResourceRegistry
    .find('', 'configmaps')!
    .withDefinition({ verbs })

const makeSection = (verbs: TKubeVerb[], object: Record<string, unknown>): TDataSectionInstance => {
    const kind = makeKind(verbs)
    const section = new (ResourceDataSection as unknown as new (store: ResourceObjectStore) => TDataSectionInstance)(
        {} as ResourceObjectStore,
    )
    section.state = { ...ResourceObjectStateFactory.empty(), object }
    section.target = { clusterId: 'prod', kind, name: 'app-config', namespace: 'default', served: [kind] }

    return section
}

describe('ResourceDataRow edit and delete gating', () => {
    const secretsKind = KubeResourceRegistry.find('', 'secrets')!
    const configMapsKind = KubeResourceRegistry.find('', 'configmaps')!

    it('allows editing printable and empty Secret.data keys while blocking binary or invalid UTF-8 blobs', () => {
        const secret = {
            apiVersion: 'v1',
            kind: 'Secret',
            metadata: { name: 'mixed', namespace: 'default' },
            data: {
                printable: btoa('plain-text'),
                empty: '',
                nulBlob: btoa('\u0000\u0001\u0002'),
                invalidUtf8: 'gP/+',
            },
        }
        const entries = DetailDataEntries.of(secret, secretsKind)
        const entryOf = (key: string): TDetailDataEntry => entries.find(item => item.key === key)!

        expect(makeRow(secret, entryOf('printable'), { editable: true, deletable: true }).canEdit).toBe(true)
        expect(makeRow(secret, entryOf('empty'), { editable: true, deletable: true }).canEdit).toBe(true)

        const nulRow = makeRow(secret, entryOf('nulBlob'), { editable: true, deletable: true })
        expect(nulRow.canEdit).toBe(false)
        expect(nulRow.canDelete).toBe(true)

        const invalidUtf8Row = makeRow(secret, entryOf('invalidUtf8'), { editable: true, deletable: true })
        expect(invalidUtf8Row.canEdit).toBe(false)
        expect(invalidUtf8Row.canDelete).toBe(true)
    })

    it('blocks editing ConfigMap.binaryData keys while still allowing deletion when deletable', () => {
        const cm = {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            metadata: { name: 'cfg', namespace: 'default' },
            data: { text: 'ok' },
            binaryData: { archive: btoa('raw-bytes') },
        }
        const entries = DetailDataEntries.of(cm, configMapsKind)
        const binaryEntry = entries.find(item => item.key === 'archive')!
        const textEntry = entries.find(item => item.key === 'text')!

        const binaryRow = makeRow(cm, binaryEntry, { editable: true, deletable: true })
        expect(binaryRow.canEdit).toBe(false)
        expect(binaryRow.canDelete).toBe(true)

        const patchOnlyRow = makeRow(cm, textEntry, { editable: true, deletable: false })
        expect(patchOnlyRow.canEdit).toBe(true)
        expect(patchOnlyRow.canDelete).toBe(false)
    })
})

describe('ResourceDataEditDialog rename gating', () => {
    it('locks the key field when editing without update permission and preserves initialKey on submit', () => {
        const dialog = makeDialog({
            initialKey: 'alpha',
            initialValue: 'one',
            existingKeys: ['alpha'],
            canRename: false,
        })

        expect(dialog.isEdit).toBe(true)
        expect(dialog.keyLocked).toBe(true)

        dialog.draft.key = 'beta'
        dialog.draft.value = 'two'
        dialog.submit()

        expect(dialog.$emit).toHaveBeenCalledWith('save', {
            key: 'alpha',
            value: 'two',
            originalKey: 'alpha',
        })
    })

    it('keeps the key field unlocked when adding a new key even when canRename is false', () => {
        const dialog = makeDialog({
            initialKey: '',
            existingKeys: ['alpha'],
            canRename: false,
        })

        expect(dialog.isEdit).toBe(false)
        expect(dialog.keyLocked).toBe(false)

        dialog.draft.key = 'beta'
        dialog.draft.value = 'two'
        dialog.submit()

        expect(dialog.$emit).toHaveBeenCalledWith('save', {
            key: 'beta',
            value: 'two',
            originalKey: undefined,
        })
    })

    it('allows renaming an existing key when canRename is true', () => {
        const dialog = makeDialog({
            initialKey: 'alpha',
            initialValue: 'one',
            existingKeys: ['alpha'],
            canRename: true,
        })

        expect(dialog.keyLocked).toBe(false)

        dialog.draft.key = 'beta'
        dialog.draft.value = 'two'
        dialog.submit()

        expect(dialog.$emit).toHaveBeenCalledWith('save', {
            key: 'beta',
            value: 'two',
            originalKey: 'alpha',
        })
    })
})

describe('ResourceDataSection permission gating', () => {
    it('allows editing but not deleting when only patch permission is granted', () => {
        const section = makeSection(['get', 'patch'], { data: { a: '1' } })

        expect(section.canEdit).toBe(true)
        expect(section.canDelete).toBe(false)
    })

    it('allows both editing and deleting when update permission is granted', () => {
        const section = makeSection(['get', 'update'], { data: { a: '1' } })

        expect(section.canEdit).toBe(true)
        expect(section.canDelete).toBe(true)
    })

    it('blocks both editing and deleting when the object is immutable', () => {
        const section = makeSection(['get', 'patch', 'update'], { immutable: true, data: { a: '1' } })

        expect(section.canEdit).toBe(false)
        expect(section.canDelete).toBe(false)
    })
})
