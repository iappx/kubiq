import type { TKubeConditionStatus } from '@/domain/entities/kube/types/TKubeConditionStatus'

export class KubeConditionStatusCatalog {
    public static readonly values: Record<TKubeConditionStatus, string> = {
        True: 'True',
        False: 'False',
        Unknown: 'Unknown',
    }

    public static title(status: TKubeConditionStatus): string {
        return KubeConditionStatusCatalog.values[status] ?? status
    }

    public static has(status: string): boolean {
        return Object.prototype.hasOwnProperty.call(KubeConditionStatusCatalog.values, status)
    }
}
