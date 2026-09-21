import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'

export class HelmReleaseColumns {
    public static all(): TUiTableColumn[] {
        return [
            { key: 'name', title: 'Name', locked: true },
            { key: 'namespace', title: 'Namespace' },
            { key: 'statusText', title: 'Status', locked: true },
            { key: 'chart', title: 'Chart' },
            { key: 'chartVersion', title: 'Chart version' },
            { key: 'appVersion', title: 'App version' },
            { key: 'revision', title: 'Revision', align: 'right' },
            { key: 'updated', title: 'Updated', align: 'right', locked: true },
        ]
    }
}
