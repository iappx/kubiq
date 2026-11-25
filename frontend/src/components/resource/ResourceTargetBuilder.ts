import type { TNodeTarget } from '@/application/services/node/types/TNodeTarget'
import type { TWorkloadTarget } from '@/application/services/workloadAction/types/TWorkloadTarget'
import type { TResourceRow } from '@/components/resource/types/TResourceRow'
import type { KubeResourceKind } from '@/domain/models/kube'

export class ResourceTargetBuilder {
    public static workloadOf(
        clusterId: string,
        kind: KubeResourceKind | null,
        row: TResourceRow | null,
    ): TWorkloadTarget | null {
        if (!row || !kind) {
            return null
        }

        return {
            clusterId,
            kind,
            name: row.name,
            namespace: row.namespace,
            rowKey: row.key,
        }
    }

    public static workloadsOf(
        clusterId: string,
        kind: KubeResourceKind | null,
        rows: readonly TResourceRow[],
    ): TWorkloadTarget[] {
        if (!kind) {
            return []
        }

        return rows.map(row => ({
            clusterId,
            kind,
            name: row.name,
            namespace: row.namespace,
            rowKey: row.key,
        }))
    }

    public static nodeOf(
        clusterId: string,
        kind: KubeResourceKind | null,
        row: TResourceRow | null,
    ): TNodeTarget | null {
        if (!row || !kind) {
            return null
        }

        return {
            clusterId,
            kind,
            name: row.name,
            rowKey: row.key,
        }
    }

    public static nodesOf(
        clusterId: string,
        kind: KubeResourceKind | null,
        rows: readonly TResourceRow[],
    ): TNodeTarget[] {
        if (!kind) {
            return []
        }

        return rows.map(row => ({
            clusterId,
            kind,
            name: row.name,
            rowKey: row.key,
        }))
    }

    public static selectedRows(rows: readonly TResourceRow[], keys: readonly string[]): TResourceRow[] {
        if (keys.length === 0) {
            return []
        }

        const chosen = new Set(keys)

        return rows.filter(row => chosen.has(row.key))
    }

    public static pruneSelected(rows: readonly TResourceRow[], keys: readonly string[]): string[] {
        if (keys.length === 0) {
            return []
        }

        const present = new Set(rows.map(row => row.key))

        return keys.filter(key => present.has(key))
    }

    public static containsObject(
        targets: readonly { namespace: string; name: string }[],
        namespace: string,
        name: string,
    ): boolean {
        if (!name) {
            return false
        }

        return targets.some(target => target.name === name && target.namespace === namespace)
    }
}
