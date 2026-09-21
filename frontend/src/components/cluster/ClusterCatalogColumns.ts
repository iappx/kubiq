import { UiTableColumns } from '@/components/common/table/UiTableColumns'
import type { TUiTableColumn } from '@/components/common/table/types/TUiTableColumn'

export class ClusterCatalogColumns {
    public static all(): TUiTableColumn[] {
        return [
            { key: 'name', title: 'Name', locked: true, width: '22%' },
            { key: 'status', title: 'Status', locked: true, width: '12%' },
            { key: 'clusterName', title: 'Cluster', width: '16%' },
            { key: 'server', title: 'Server', width: '24%' },
            { key: 'namespace', title: 'Namespace', width: '12%' },
            { key: 'version', title: 'Version', width: '10%' },
            { key: 'authType', title: 'Authentication', priority: 1 },
            { key: 'source', title: 'Kubeconfig', priority: 1 },
            { key: 'action', title: '', locked: true, sortable: false, align: 'right', width: '44px' },
        ]
    }

    public static defaultHidden(): string[] {
        return UiTableColumns.defaultHidden(ClusterCatalogColumns.all())
    }
}
