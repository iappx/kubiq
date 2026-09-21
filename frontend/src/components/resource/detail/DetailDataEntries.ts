import type { TDetailDataEntry } from '@/components/resource/detail/types/TDetailDataEntry'
import { KubeDataMapReader } from '@/domain/entities/config'
import type { TKubeDataMap } from '@/domain/entities/config'
import { KubeClusterCatalog, KubeManifest } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'

export class DetailDataEntries {
    public static readonly dataField: string = 'data'

    public static readonly stringDataField: string = 'stringData'

    public static readonly binaryDataField: string = 'binaryData'

    // `data` is base64 on a Secret and plain text on a ConfigMap; `binaryData` is base64 on both.
    public static of(object: Record<string, unknown>, kind: KubeResourceKind | null): TDetailDataEntry[] {
        const secret = kind !== null && KubeClusterCatalog.isSecret(kind)

        return [
            ...DetailDataEntries.fromField(object, DetailDataEntries.dataField, secret, false, secret),
            ...DetailDataEntries.fromField(object, DetailDataEntries.stringDataField, false, false, secret),
            ...DetailDataEntries.fromField(object, DetailDataEntries.binaryDataField, true, true, secret),
        ]
    }

    public static valueOf(object: Record<string, unknown>, entry: TDetailDataEntry): string {
        const map = DetailDataEntries.mapOf(object, entry.field)

        return entry.encoded ? KubeDataMapReader.decode(map, entry.key) : KubeDataMapReader.plain(map, entry.key)
    }

    public static isPrintable(object: Record<string, unknown>, entry: TDetailDataEntry): boolean {
        return !entry.binary && KubeDataMapReader.isPrintable(DetailDataEntries.valueOf(object, entry))
    }

    private static fromField(
        object: Record<string, unknown>,
        field: string,
        encoded: boolean,
        binary: boolean,
        secret: boolean,
    ): TDetailDataEntry[] {
        const map = DetailDataEntries.mapOf(object, field)

        return KubeDataMapReader.keysOf(map).map(key => ({
            key,
            field,
            encoded,
            binary,
            hidden: secret,
            size: encoded ? KubeDataMapReader.sizeOf(map, key) : KubeDataMapReader.plain(map, key).length,
        }))
    }

    private static mapOf(object: Record<string, unknown>, field: string): TKubeDataMap | undefined {
        const value = object[field]

        return KubeManifest.isObject(value) ? value as TKubeDataMap : undefined
    }
}
