import { KubeResourceKind } from '@/domain/models/kube/KubeResourceKind'

export class KubeClusterCatalog {
    public static readonly configMapsKey: string = KubeResourceKind.registryKeyOf('', 'configmaps')

    public static readonly secretsKey: string = KubeResourceKind.registryKeyOf('', 'secrets')

    public static readonly nodesKey: string = KubeResourceKind.registryKeyOf('', 'nodes')

    public static readonly namespacesKey: string = KubeResourceKind.registryKeyOf('', 'namespaces')

    public static readonly eventsKey: string = KubeResourceKind.registryKeyOf('', 'events')

    public static readonly crdsKey: string = KubeResourceKind.registryKeyOf('apiextensions.k8s.io', 'customresourcedefinitions')

    public static isConfigMap(kind: KubeResourceKind): boolean {
        return kind.registryKey === KubeClusterCatalog.configMapsKey
    }

    public static isSecret(kind: KubeResourceKind): boolean {
        return kind.registryKey === KubeClusterCatalog.secretsKey
    }

    public static hasDataMap(kind: KubeResourceKind): boolean {
        return KubeClusterCatalog.isConfigMap(kind) || KubeClusterCatalog.isSecret(kind)
    }

    public static isNode(kind: KubeResourceKind): boolean {
        return kind.registryKey === KubeClusterCatalog.nodesKey
    }

    public static isNamespace(kind: KubeResourceKind): boolean {
        return kind.registryKey === KubeClusterCatalog.namespacesKey
    }

    public static isEvent(kind: KubeResourceKind): boolean {
        return kind.registryKey === KubeClusterCatalog.eventsKey
    }

    public static isCrd(kind: KubeResourceKind): boolean {
        return kind.registryKey === KubeClusterCatalog.crdsKey
    }

    public static canCordon(kind: KubeResourceKind): boolean {
        return KubeClusterCatalog.isNode(kind) && kind.canPatch
    }

    public static canDrain(kind: KubeResourceKind): boolean {
        return KubeClusterCatalog.canCordon(kind)
    }
}
