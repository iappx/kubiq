import type { TServiceType } from '@/domain/entities/network/types/TServiceType'

export class ServiceTypeCatalog {
    public static readonly values: Record<TServiceType, string> = {
        ClusterIP: 'ClusterIP',
        NodePort: 'NodePort',
        LoadBalancer: 'LoadBalancer',
        ExternalName: 'ExternalName',
    }

    public static title(type: TServiceType): string {
        return ServiceTypeCatalog.values[type] ?? type
    }

    public static has(type: string): boolean {
        return Object.prototype.hasOwnProperty.call(ServiceTypeCatalog.values, type)
    }
}
