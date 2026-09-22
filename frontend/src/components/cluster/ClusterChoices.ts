import type { TClusterRow } from '@/components/cluster/types/TClusterRow'

export class ClusterChoices {
    public static ordered(rows: readonly TClusterRow[]): TClusterRow[] {
        return [
            ...rows.filter(row => row.isConnected),
            ...rows.filter(row => !row.isConnected),
        ]
    }

    public static hintOf(row: TClusterRow): string {
        return `${row.statusTitle} · ${row.detail === '' ? row.server : row.detail}`
    }
}
