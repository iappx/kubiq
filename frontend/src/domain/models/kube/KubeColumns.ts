import type { TKubeColumn } from '@/domain/models/kube/types/TKubeColumn'

export class KubeColumns {
    public static objectName(): TKubeColumn {
        return { key: 'name', title: 'Name' }
    }

    public static namespace(): TKubeColumn {
        return { key: 'namespace', title: 'Namespace' }
    }

    public static age(): TKubeColumn {
        return { key: 'createdAt', title: 'Age' }
    }

    public static state(): TKubeColumn {
        return { key: 'state', title: 'Status' }
    }

    public static base(namespaced: boolean): TKubeColumn[] {
        return namespaced ? [KubeColumns.objectName(), KubeColumns.namespace()] : [KubeColumns.objectName()]
    }

    public static baseWithAge(namespaced: boolean): TKubeColumn[] {
        return [...KubeColumns.base(namespaced), KubeColumns.age()]
    }
}
