import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'

export class ArgoApplicationColumns {
    public static all(): TUiTableColumn[] {
        return [
            { key: 'name', title: 'Name', locked: true },
            { key: 'project', title: 'Project' },
            { key: 'syncText', title: 'Sync', locked: true },
            { key: 'healthText', title: 'Health', locked: true },
            { key: 'destinationNamespace', title: 'Destination' },
            { key: 'sourceText', title: 'Source' },
            { key: 'targetRevision', title: 'Target revision' },
            { key: 'syncPolicyText', title: 'Sync policy' },
            { key: 'resourceCount', title: 'Objects', align: 'right' },
            { key: 'namespace', title: 'Namespace' },
            { key: 'createdAt', title: 'Age', align: 'right', locked: true },
        ]
    }

    public static hiddenByDefault(): string[] {
        return ['targetRevision', 'syncPolicyText', 'resourceCount', 'namespace']
    }
}
