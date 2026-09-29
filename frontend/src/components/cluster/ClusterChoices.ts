import type { TClusterRow } from '@/components/cluster/types/TClusterRow'

export class ClusterChoices {
    public static ordered(rows: readonly TClusterRow[]): TClusterRow[] {
        return [
            ...rows.filter(row => row.isConnected),
            ...rows.filter(row => !row.isConnected),
        ]
    }

    public static hintOf(row: TClusterRow): string {
        const context = row.displayName === row.name ? '' : `${row.name} · `

        return `${context}${row.statusTitle} · ${row.detail === '' ? row.server : row.detail}`
    }
}
