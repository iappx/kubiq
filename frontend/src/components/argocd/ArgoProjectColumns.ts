import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'

export class ArgoProjectColumns {
    public static all(): TUiTableColumn[] {
        return [
            { key: 'name', title: 'Name', locked: true },
            { key: 'description', title: 'Description' },
            { key: 'applicationCount', title: 'Applications', align: 'right' },
            { key: 'sourceRepos', title: 'Source repositories' },
            { key: 'destinations', title: 'Destinations' },
            { key: 'namespace', title: 'Namespace' },
            { key: 'createdAt', title: 'Age', align: 'right', locked: true },
        ]
    }

    public static hiddenByDefault(): string[] {
        return ['namespace']
    }
}
