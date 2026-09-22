import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'

export class ArgoApplicationSetColumns {
    public static all(): TUiTableColumn[] {
        return [
            { key: 'name', title: 'Name', locked: true },
            { key: 'project', title: 'Project' },
            { key: 'generators', title: 'Generators' },
            { key: 'strategy', title: 'Strategy' },
            { key: 'statusText', title: 'Status', locked: true },
            { key: 'namespace', title: 'Namespace' },
            { key: 'createdAt', title: 'Age', align: 'right', locked: true },
        ]
    }

    public static hiddenByDefault(): string[] {
        return ['namespace']
    }
}
