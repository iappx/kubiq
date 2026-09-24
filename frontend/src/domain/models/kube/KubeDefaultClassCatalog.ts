import { IngressClassEntity } from '@/domain/entities/network/IngressClassEntity'
import { StorageClassEntity } from '@/domain/entities/storage/StorageClassEntity'
import { KubeResourceKind } from '@/domain/models/kube/KubeResourceKind'

export class KubeDefaultClassCatalog {
    public static readonly storageClassesKey: string = KubeResourceKind.registryKeyOf('storage.k8s.io', 'storageclasses')

    public static readonly ingressClassesKey: string = KubeResourceKind.registryKeyOf('networking.k8s.io', 'ingressclasses')

    public static annotationOf(kind: KubeResourceKind): string {
        switch (kind.registryKey) {
            case KubeDefaultClassCatalog.storageClassesKey:
                return StorageClassEntity.defaultAnnotation
            case KubeDefaultClassCatalog.ingressClassesKey:
                return IngressClassEntity.defaultAnnotation
            default:
                return ''
        }
    }

    public static hasDefault(kind: KubeResourceKind): boolean {
        return KubeDefaultClassCatalog.annotationOf(kind) !== ''
    }

    public static canSetDefault(kind: KubeResourceKind): boolean {
        return KubeDefaultClassCatalog.hasDefault(kind) && kind.canPatch
    }
}
