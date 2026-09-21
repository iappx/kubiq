import type { RepoEntityBase } from '@iappx/entity-repo'
import { ResourceColumns } from '@/components/resource/ResourceColumns'
import type { TResourceRow } from '@/components/resource/types/TResourceRow'
import type { TUiTone } from '@/components/common/status/types/TUiTone'
import { KubeObjectHealth, KubeObjectKey, KubeObjectStateCatalog } from '@/domain/entities/kube'
import { KubeJsonPath } from '@/domain/models/kube'
import type { TKubeColumn } from '@/domain/models/kube'

export class ResourceRowBuilder {
    public static build(items: readonly RepoEntityBase[], columns: readonly TKubeColumn[]): TResourceRow[] {
        return items.map(item => ResourceRowBuilder.toRow(item, columns))
    }

    public static keyOf(entity: RepoEntityBase): string {
        return KubeObjectKey.of(entity)
    }

    public static toneOf(entity: RepoEntityBase): TUiTone {
        return KubeObjectHealth.stateOf(entity)
    }

    public static valueOf(entity: RepoEntityBase, column: TKubeColumn): unknown {
        if (column.jsonPath) {
            return KubeJsonPath.read(entity, column.jsonPath)
        }

        return (entity as unknown as Record<string, unknown>)[column.key]
    }

    private static toRow(entity: RepoEntityBase, columns: readonly TKubeColumn[]): TResourceRow {
        const source = entity as unknown as Record<string, unknown>
        const tone = ResourceRowBuilder.toneOf(entity)

        const row: TResourceRow = {
            key: ResourceRowBuilder.keyOf(entity),
            name: ResourceRowBuilder.text(source.name),
            namespace: ResourceRowBuilder.text(source.namespace),
            createdAt: ResourceRowBuilder.text(source.createdAt),
            tone,
            statusTitle: KubeObjectStateCatalog.title(tone === 'info' ? 'unknown' : tone),
        }

        columns.forEach((column) => {
            if (!ResourceRowBuilder.isFixed(column.key)) {
                row[column.key] = ResourceRowBuilder.valueOf(entity, column)
            }
        })

        return row
    }

    private static isFixed(key: string): boolean {
        return key === ResourceColumns.nameKey
            || key === ResourceColumns.namespaceKey
            || key === ResourceColumns.ageKey
    }

    private static text(value: unknown): string {
        return typeof value === 'string' ? value : ''
    }
}
