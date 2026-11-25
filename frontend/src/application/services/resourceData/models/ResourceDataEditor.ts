import type { TResourceDataEditDraft } from '@/application/services/resourceData/types/TResourceDataEditDraft'
import { KubeManifest } from '@/domain/models/kube'
import { Base64 } from '@/lib/encoding/Base64'

export class ResourceDataEditor {
    public static readonly dataField: string = 'data'

    public static readonly stringDataField: string = 'stringData'

    public static isImmutable(object: Record<string, unknown>): boolean {
        return object.immutable === true
    }

    public static upsert(
        object: Record<string, unknown>,
        isSecret: boolean,
        draft: TResourceDataEditDraft,
    ): Record<string, unknown> {
        const next: Record<string, unknown> = { ...object }
        const data = ResourceDataEditor.cloneStringMap(object[ResourceDataEditor.dataField])

        if (draft.originalKey && draft.originalKey !== draft.key) {
            delete data[draft.originalKey]

            if (isSecret && KubeManifest.isObject(object[ResourceDataEditor.stringDataField])) {
                const stringData = ResourceDataEditor.cloneStringMap(object[ResourceDataEditor.stringDataField])
                if (draft.originalKey in stringData) {
                    delete stringData[draft.originalKey]
                    next[ResourceDataEditor.stringDataField] = stringData
                }
            }
        }

        data[draft.key] = isSecret ? Base64.stringToB64(draft.value) : draft.value
        next[ResourceDataEditor.dataField] = data

        return next
    }

    public static remove(
        object: Record<string, unknown>,
        key: string,
        field: string = ResourceDataEditor.dataField,
    ): Record<string, unknown> {
        const next: Record<string, unknown> = { ...object }
        if (!KubeManifest.isObject(object[field])) {
            return next
        }

        const entries: Record<string, unknown> = { ...(object[field] as Record<string, unknown>) }
        delete entries[key]
        next[field] = entries

        return next
    }

    private static cloneStringMap(value: unknown): Record<string, string> {
        return KubeManifest.isObject(value) ? { ...(value as Record<string, string>) } : {}
    }
}
